import type { Request } from "express";
import { describe, expect, it, vi } from "vitest";

import { SignOutUseCase } from "../../application/sign-out.use-case";

import { SignOutRequestHandler } from "./sign-out.request-handler";

function requestWithAuthorization(authorization?: string): Request {
  return {
    headers: authorization === undefined ? {} : { authorization },
  } as unknown as Request;
}

function handlerWith(execute: (token: string) => Promise<void>) {
  return new SignOutRequestHandler({
    execute,
  } as unknown as SignOutUseCase);
}

describe("SignOutRequestHandler", () => {
  it("deve revogar a sessão do token Bearer e não devolver corpo", async () => {
    const execute = vi.fn(async () => {});
    const handler = handlerWith(execute);

    const result = await handler.handle(
      requestWithAuthorization("Bearer token-123"),
    );

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith("token-123");
    expect(result).toBeUndefined();
  });

  it("não deve chamar o use case quando o header está ausente", async () => {
    const execute = vi.fn(async () => {});

    await handlerWith(execute).handle(requestWithAuthorization());

    expect(execute).not.toHaveBeenCalled();
  });

  it("não deve chamar o use case quando o header é malformado", async () => {
    const execute = vi.fn(async () => {});
    const handler = handlerWith(execute);

    await handler.handle(requestWithAuthorization("Token token-123"));
    await handler.handle(requestWithAuthorization("Bearer"));

    expect(execute).not.toHaveBeenCalled();
  });
});
