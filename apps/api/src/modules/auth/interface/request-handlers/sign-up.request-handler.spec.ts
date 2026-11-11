import type { Request, Response } from "express";
import { HttpException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { SignUpUseCase } from "../../application/sign-up.use-case";
import type { AuthUser } from "../../domain/auth-user";
import {
  ConfirmationEmailDeliveryError,
  EmailAlreadyConfirmedError,
} from "../../domain/sign-up.errors";

import { SignUpRateLimiter } from "../sign-up-rate-limiter";

import {
  SIGN_UP_CONFLICT_MESSAGE,
  SIGN_UP_SUCCESS_MESSAGE,
  SignUpRequestHandler,
} from "./sign-up.request-handler";

const user: AuthUser = {
  id: "11111111-1111-1111-1111-111111111111",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
};

const validBody = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
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
  execute: (input: unknown) => Promise<unknown>,
  rateLimiter: {
    consume: () => { allowed: boolean; retryAfterSeconds: number };
  },
) {
  return new SignUpRequestHandler(
    { execute } as unknown as SignUpUseCase,
    rateLimiter as unknown as SignUpRateLimiter,
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

describe("SignUpRequestHandler", () => {
  it("deve responder 201 com user quando a conta é criada", async () => {
    const execute = vi.fn(async () => ({ created: true, user }));
    const res = response();

    const result = await handlerWith(execute, limiter(true)).handle(
      validBody,
      request(),
      res as unknown as Response,
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(result).toEqual({ message: SIGN_UP_SUCCESS_MESSAGE, user });
  });

  it("deve responder 200 sem user quando a confirmação é reenviada", async () => {
    const execute = vi.fn(async () => ({ created: false, user }));
    const res = response();

    const result = await handlerWith(execute, limiter(true)).handle(
      validBody,
      request(),
      res as unknown as Response,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(result).toEqual({ message: SIGN_UP_SUCCESS_MESSAGE });
  });

  it("deve responder 429 antes de validar o corpo", async () => {
    const execute = vi.fn(async () => ({ created: true, user }));
    const rateLimiter = limiter(false, 42);
    const res = response();

    const error = await catchHttp(
      handlerWith(execute, rateLimiter).handle(
        {},
        request(),
        res as unknown as Response,
      ),
    );

    expect(error.getStatus()).toBe(429);
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "42");
    expect(rateLimiter.consume).toHaveBeenCalledTimes(1);
    expect(execute).not.toHaveBeenCalled();
  });

  it("deve responder 400 com fieldErrors quando o corpo é inválido", async () => {
    const execute = vi.fn(async () => ({ created: true, user }));

    const error = await catchHttp(
      handlerWith(execute, limiter(true)).handle(
        {},
        request(),
        response() as unknown as Response,
      ),
    );

    expect(error.getStatus()).toBe(400);
    expect(error.getResponse()).toMatchObject({
      code: "VALIDATION_ERROR",
      fieldErrors: {
        firstName: expect.any(String),
        lastName: expect.any(String),
        email: expect.any(String),
        password: expect.any(String),
        passwordConfirmation: expect.any(String),
      },
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("deve mapear e-mail já confirmado para 409", async () => {
    const execute = vi.fn().mockRejectedValue(new EmailAlreadyConfirmedError());

    const error = await catchHttp(
      handlerWith(execute, limiter(true)).handle(
        validBody,
        request(),
        response() as unknown as Response,
      ),
    );

    expect(error.getStatus()).toBe(409);
    expect(error.getResponse()).toMatchObject({
      code: "EMAIL_ALREADY_CONFIRMED",
      message: SIGN_UP_CONFLICT_MESSAGE,
    });
  });

  it("deve mapear falha de e-mail para 503", async () => {
    const execute = vi
      .fn()
      .mockRejectedValue(new ConfirmationEmailDeliveryError());

    const error = await catchHttp(
      handlerWith(execute, limiter(true)).handle(
        validBody,
        request(),
        response() as unknown as Response,
      ),
    );

    expect(error.getStatus()).toBe(503);
    expect(error.getResponse()).toMatchObject({
      code: "CONFIRMATION_EMAIL_FAILED",
    });
  });
});
