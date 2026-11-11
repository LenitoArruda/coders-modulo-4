import { HttpException } from "@nestjs/common";
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import { ResetPasswordUseCase } from "../../application/reset-password.use-case";
import { InvalidResetTokenError } from "../../domain/reset-password.errors";

import { ResetPasswordRateLimiter } from "../reset-password-rate-limiter";

import {
  RESET_PASSWORD_INVALID_TOKEN_MESSAGE,
  RESET_PASSWORD_SUCCESS_MESSAGE,
  ResetPasswordRequestHandler,
} from "./reset-password.request-handler";

const validBody = {
  token: "reset-token",
  password: "password123",
  passwordConfirmation: "password123",
};

function request(): Request {
  return {
    ip: "203.0.113.7",
    socket: { remoteAddress: "203.0.113.7" },
  } as unknown as Request;
}

function response() {
  return { setHeader: vi.fn(), status: vi.fn() };
}

function limiter(allowed: boolean, retryAfterSeconds = 0) {
  return {
    consume: vi.fn(() => ({ allowed, retryAfterSeconds })),
  };
}

function handlerWith(
  execute: (input: unknown) => Promise<void>,
  rateLimiter: {
    consume: () => { allowed: boolean; retryAfterSeconds: number };
  },
) {
  return new ResetPasswordRequestHandler(
    { execute } as unknown as ResetPasswordUseCase,
    rateLimiter as unknown as ResetPasswordRateLimiter,
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

describe("ResetPasswordRequestHandler", () => {
  it("deve responder 429 sem trocar a senha", async () => {
    const execute = vi.fn(async () => {});
    const rateLimiter = limiter(false, 12);
    const res = response();

    const error = await catchHttp(
      handlerWith(execute, rateLimiter).handle(
        validBody,
        request(),
        res as unknown as Response,
      ),
    );

    expect(error.getStatus()).toBe(429);
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "12");
    expect(execute).not.toHaveBeenCalled();
  });

  it("deve responder 400 de validação antes de olhar o token", async () => {
    const execute = vi.fn(async () => {});

    const error = await catchHttp(
      handlerWith(execute, limiter(true)).handle(
        {
          token: "invalid-token",
          password: "short",
          passwordConfirmation: "short",
        },
        request(),
        response() as unknown as Response,
      ),
    );

    expect(error.getStatus()).toBe(400);
    expect(error.getResponse()).toMatchObject({
      code: "VALIDATION_ERROR",
      fieldErrors: { password: expect.any(String) },
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("deve mapear token inválido para 400 INVALID_RESET_TOKEN", async () => {
    const execute = vi.fn().mockRejectedValue(new InvalidResetTokenError());

    const error = await catchHttp(
      handlerWith(execute, limiter(true)).handle(
        validBody,
        request(),
        response() as unknown as Response,
      ),
    );

    expect(error.getStatus()).toBe(400);
    expect(error.getResponse()).toMatchObject({
      code: "INVALID_RESET_TOKEN",
      message: RESET_PASSWORD_INVALID_TOKEN_MESSAGE,
    });
  });

  it("deve devolver a mensagem de sucesso no 200", async () => {
    const execute = vi.fn(async () => {});

    const result = await handlerWith(execute, limiter(true)).handle(
      validBody,
      request(),
      response() as unknown as Response,
    );

    expect(execute).toHaveBeenCalledWith({
      token: "reset-token",
      password: "password123",
    });
    expect(result).toEqual({ message: RESET_PASSWORD_SUCCESS_MESSAGE });
  });
});
