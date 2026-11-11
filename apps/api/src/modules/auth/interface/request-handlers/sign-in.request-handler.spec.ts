import { HttpException } from "@nestjs/common";
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import { SignInUseCase } from "../../application/sign-in.use-case";
import type { AuthUser } from "../../domain/auth-user";
import {
  EmailNotConfirmedError,
  InvalidCredentialsError,
} from "../../domain/sign-in.errors";

import { SignInRateLimiter } from "../sign-in-rate-limiter";

import {
  SIGN_IN_EMAIL_NOT_CONFIRMED_MESSAGE,
  SIGN_IN_INVALID_CREDENTIALS_MESSAGE,
  SignInRequestHandler,
} from "./sign-in.request-handler";

const user: AuthUser = {
  id: "11111111-1111-1111-1111-111111111111",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
};

const validBody = { email: "ada@example.com", password: "password123" };

const signInResult = {
  accessToken: "access-token",
  tokenType: "Bearer" as const,
  expiresIn: 3600,
  user,
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
  return new SignInRequestHandler(
    { execute } as unknown as SignInUseCase,
    rateLimiter as unknown as SignInRateLimiter,
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

describe("SignInRequestHandler", () => {
  it("deve responder 400 antes de consultar o rate limiter", async () => {
    const execute = vi.fn(async () => signInResult);
    const rateLimiter = limiter(true);

    const error = await catchHttp(
      handlerWith(execute, rateLimiter).handle(
        {},
        request(),
        response() as unknown as Response,
      ),
    );

    expect(error.getStatus()).toBe(400);
    expect(error.getResponse()).toMatchObject({ code: "VALIDATION_ERROR" });
    expect(rateLimiter.consume).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it("deve responder 429 com Retry-After e não autenticar", async () => {
    const execute = vi.fn(async () => signInResult);
    const rateLimiter = limiter(false, 15);
    const res = response();

    const error = await catchHttp(
      handlerWith(execute, rateLimiter).handle(
        validBody,
        request(),
        res as unknown as Response,
      ),
    );

    expect(error.getStatus()).toBe(429);
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "15");
    expect(execute).not.toHaveBeenCalled();
  });

  it("deve mapear credenciais inválidas para 401", async () => {
    const execute = vi.fn().mockRejectedValue(new InvalidCredentialsError());

    const error = await catchHttp(
      handlerWith(execute, limiter(true)).handle(
        validBody,
        request(),
        response() as unknown as Response,
      ),
    );

    expect(error.getStatus()).toBe(401);
    expect(error.getResponse()).toMatchObject({
      code: "INVALID_CREDENTIALS",
      message: SIGN_IN_INVALID_CREDENTIALS_MESSAGE,
    });
  });

  it("deve mapear e-mail não confirmado para 403", async () => {
    const execute = vi.fn().mockRejectedValue(new EmailNotConfirmedError());

    const error = await catchHttp(
      handlerWith(execute, limiter(true)).handle(
        validBody,
        request(),
        response() as unknown as Response,
      ),
    );

    expect(error.getStatus()).toBe(403);
    expect(error.getResponse()).toMatchObject({
      code: "EMAIL_NOT_CONFIRMED",
      message: SIGN_IN_EMAIL_NOT_CONFIRMED_MESSAGE,
    });
  });

  it("deve devolver a sessão criada no sucesso", async () => {
    const execute = vi.fn(async () => signInResult);

    const result = await handlerWith(execute, limiter(true)).handle(
      validBody,
      request(),
      response() as unknown as Response,
    );

    expect(execute).toHaveBeenCalledWith({
      email: "ada@example.com",
      password: "password123",
    });
    expect(result).toEqual(signInResult);
  });
});
