import { HttpException } from "@nestjs/common";
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import { ConfirmAccountUseCase } from "../../application/confirm-account.use-case";
import type { AuthUser } from "../../domain/auth-user";
import {
  AccountAlreadyConfirmedError,
  InvalidConfirmationTokenError,
} from "../../domain/confirmation.errors";

import { ConfirmationRateLimiter } from "../confirmation-rate-limiter";

import {
  CONFIRM_ALREADY_CONFIRMED_MESSAGE,
  CONFIRM_INVALID_MESSAGE,
  ConfirmAccountRequestHandler,
} from "./confirm-account.request-handler";

const user: AuthUser = {
  id: "11111111-1111-1111-1111-111111111111",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
};

const confirmResult = {
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
  execute: (token: string) => Promise<unknown>,
  rateLimiter: {
    consume: () => { allowed: boolean; retryAfterSeconds: number };
  },
) {
  return new ConfirmAccountRequestHandler(
    { execute } as unknown as ConfirmAccountUseCase,
    rateLimiter as unknown as ConfirmationRateLimiter,
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

describe("ConfirmAccountRequestHandler", () => {
  it("deve responder 429 antes de ler o token", async () => {
    const execute = vi.fn(async () => confirmResult);
    const rateLimiter = limiter(false, 20);
    const res = response();

    const error = await catchHttp(
      handlerWith(execute, rateLimiter).handle(
        {},
        request(),
        res as unknown as Response,
      ),
    );

    expect(error.getStatus()).toBe(429);
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "20");
    expect(execute).not.toHaveBeenCalled();
  });

  it("deve responder 400 INVALID_CONFIRMATION_TOKEN quando o token está ausente", async () => {
    const execute = vi.fn(async () => confirmResult);

    const error = await catchHttp(
      handlerWith(execute, limiter(true)).handle(
        {},
        request(),
        response() as unknown as Response,
      ),
    );

    expect(error.getStatus()).toBe(400);
    expect(error.getResponse()).toMatchObject({
      code: "INVALID_CONFIRMATION_TOKEN",
      message: CONFIRM_INVALID_MESSAGE,
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("deve mapear token inválido para 400 INVALID_CONFIRMATION_TOKEN", async () => {
    const execute = vi
      .fn()
      .mockRejectedValue(new InvalidConfirmationTokenError());

    const error = await catchHttp(
      handlerWith(execute, limiter(true)).handle(
        { token: "expired-token" },
        request(),
        response() as unknown as Response,
      ),
    );

    expect(error.getStatus()).toBe(400);
    expect(error.getResponse()).toMatchObject({
      code: "INVALID_CONFIRMATION_TOKEN",
      message: CONFIRM_INVALID_MESSAGE,
    });
    expect(execute).toHaveBeenCalledWith("expired-token");
  });

  it("deve mapear conta já confirmada para 409", async () => {
    const execute = vi
      .fn()
      .mockRejectedValue(new AccountAlreadyConfirmedError());

    const error = await catchHttp(
      handlerWith(execute, limiter(true)).handle(
        { token: "used-token" },
        request(),
        response() as unknown as Response,
      ),
    );

    expect(error.getStatus()).toBe(409);
    expect(error.getResponse()).toMatchObject({
      code: "ACCOUNT_ALREADY_CONFIRMED",
      message: CONFIRM_ALREADY_CONFIRMED_MESSAGE,
    });
  });

  it("deve devolver a sessão criada no 200", async () => {
    const execute = vi.fn(async () => confirmResult);

    const result = await handlerWith(execute, limiter(true)).handle(
      { token: " confirm-token " },
      request(),
      response() as unknown as Response,
    );

    expect(execute).toHaveBeenCalledWith("confirm-token");
    expect(result).toEqual(confirmResult);
  });
});
