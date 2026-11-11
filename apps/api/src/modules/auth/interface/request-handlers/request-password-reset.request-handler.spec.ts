import { HttpException } from "@nestjs/common";
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import { RequestPasswordResetUseCase } from "../../application/request-password-reset.use-case";

import { ForgotPasswordRateLimiter } from "../forgot-password-rate-limiter";

import {
  FORGOT_PASSWORD_SUCCESS_MESSAGE,
  RequestPasswordResetRequestHandler,
} from "./request-password-reset.request-handler";

function request(): Request {
  return {
    ip: "203.0.113.7",
    socket: { remoteAddress: "203.0.113.7" },
  } as unknown as Request;
}

function response() {
  return { setHeader: vi.fn(), status: vi.fn() };
}

function limiter() {
  return { consume: vi.fn() };
}

function handlerWith(
  execute: (input: unknown) => Promise<void>,
  rateLimiter: { consume: () => unknown },
) {
  return new RequestPasswordResetRequestHandler(
    { execute } as unknown as RequestPasswordResetUseCase,
    rateLimiter as unknown as ForgotPasswordRateLimiter,
  );
}

async function catchHttp(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) {
      return error;
    }

    throw error;
  }

  throw new Error("Expected the handler to throw an HttpException");
}

describe("RequestPasswordResetRequestHandler", () => {
  it("deve responder 429 do limite por IP antes de validar o corpo", async () => {
    const execute = vi.fn(async () => {});
    const rateLimiter = limiter();
    rateLimiter.consume.mockReturnValueOnce({
      allowed: false,
      retryAfterSeconds: 9,
    });
    const res = response();

    const error = await catchHttp(
      handlerWith(execute, rateLimiter).handle(
        {},
        request(),
        res as unknown as Response,
      ),
    );

    expect(error.getStatus()).toBe(429);
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "9");
    expect(rateLimiter.consume).toHaveBeenCalledTimes(1);
    expect(execute).not.toHaveBeenCalled();
  });

  it("deve responder 400 com fieldErrors.email para e-mail inválido", async () => {
    const execute = vi.fn(async () => {});
    const rateLimiter = limiter();
    rateLimiter.consume.mockReturnValueOnce({
      allowed: true,
      retryAfterSeconds: 0,
    });

    const error = await catchHttp(
      handlerWith(execute, rateLimiter).handle(
        { email: "not-an-email" },
        request(),
        response() as unknown as Response,
      ),
    );

    expect(error.getStatus()).toBe(400);
    expect(error.getResponse()).toMatchObject({
      code: "VALIDATION_ERROR",
      fieldErrors: { email: expect.any(String) },
    });
    expect(rateLimiter.consume).toHaveBeenCalledTimes(1);
    expect(execute).not.toHaveBeenCalled();
  });

  it("deve responder 429 do limite por e-mail depois da validação", async () => {
    const execute = vi.fn(async () => {});
    const rateLimiter = limiter();
    rateLimiter.consume
      .mockReturnValueOnce({ allowed: true, retryAfterSeconds: 0 })
      .mockReturnValueOnce({ allowed: false, retryAfterSeconds: 30 });
    const res = response();

    const error = await catchHttp(
      handlerWith(execute, rateLimiter).handle(
        { email: " Ada@Example.com " },
        request(),
        res as unknown as Response,
      ),
    );

    expect(error.getStatus()).toBe(429);
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "30");
    expect(rateLimiter.consume).toHaveBeenNthCalledWith(1, "ip:203.0.113.7");
    expect(rateLimiter.consume).toHaveBeenNthCalledWith(
      2,
      "email:ada@example.com",
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it("deve responder 200 genérico para e-mail válido", async () => {
    const execute = vi.fn(async () => {});
    const rateLimiter = limiter();
    rateLimiter.consume.mockReturnValue({
      allowed: true,
      retryAfterSeconds: 0,
    });

    const result = await handlerWith(execute, rateLimiter).handle(
      { email: " Ada@Example.com " },
      request(),
      response() as unknown as Response,
    );

    expect(execute).toHaveBeenCalledWith({ email: "ada@example.com" });
    expect(result).toEqual({ message: FORGOT_PASSWORD_SUCCESS_MESSAGE });
  });
});
