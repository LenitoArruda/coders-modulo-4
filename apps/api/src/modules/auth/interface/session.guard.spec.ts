import { type ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { InvalidSessionError } from "../domain/invalid-session.error";
import { ValidateSessionUseCase } from "../application/validate-session.use-case";

import type { AuthenticatedRequest } from "./authenticated-request";
import { extractBearerToken, SessionGuard } from "./session.guard";

const user = {
  id: "11111111-1111-1111-1111-111111111111",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
};

function contextFor(request: Partial<AuthenticatedRequest>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function createGuard(execute: ReturnType<typeof vi.fn>) {
  return new SessionGuard({
    execute,
  } as unknown as ValidateSessionUseCase);
}

describe("extractBearerToken", () => {
  it("deve extrair o token de um header Bearer", () => {
    expect(extractBearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
  });

  it("deve aceitar o esquema em qualquer caixa", () => {
    expect(extractBearerToken("bearer abc")).toBe("abc");
  });

  it("deve tolerar espaços extras", () => {
    expect(extractBearerToken("  Bearer   abc  ")).toBe("abc");
  });

  it("deve retornar nulo para header ausente ou vazio", () => {
    expect(extractBearerToken(undefined)).toBeNull();
    expect(extractBearerToken("   ")).toBeNull();
  });

  it("deve retornar nulo para outros esquemas ou token vazio", () => {
    expect(extractBearerToken("Token abc")).toBeNull();
    expect(extractBearerToken("Bearer")).toBeNull();
    expect(extractBearerToken("Bearer a b")).toBeNull();
  });
});

describe("SessionGuard", () => {
  it("deve anexar a pessoa autenticada na requisição", async () => {
    const execute = vi.fn().mockResolvedValue(user);
    const request: AuthenticatedRequest = {
      headers: { authorization: "Bearer abc" },
    } as AuthenticatedRequest;

    await expect(
      createGuard(execute).canActivate(contextFor(request)),
    ).resolves.toBe(true);
    expect(request.user).toEqual(user);
    expect(execute).toHaveBeenCalledWith("abc");
  });

  it("deve responder 401 quando o token está ausente", async () => {
    const execute = vi.fn();
    const request = { headers: {} } as AuthenticatedRequest;

    await expect(
      createGuard(execute).canActivate(contextFor(request)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(execute).not.toHaveBeenCalled();
  });

  it("deve converter InvalidSessionError no 401 do contrato", async () => {
    const execute = vi.fn().mockRejectedValue(new InvalidSessionError());
    const request = {
      headers: { authorization: "Bearer abc" },
    } as AuthenticatedRequest;

    const error = await createGuard(execute)
      .canActivate(contextFor(request))
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(UnauthorizedException);
    expect((error as UnauthorizedException).getResponse()).toEqual({
      code: "UNAUTHORIZED",
      message: "Your session is invalid or has expired. Sign in again.",
    });
  });

  it("não deve mascarar erros inesperados", async () => {
    const failure = new Error("database unavailable");
    const execute = vi.fn().mockRejectedValue(failure);
    const request = {
      headers: { authorization: "Bearer abc" },
    } as AuthenticatedRequest;

    await expect(
      createGuard(execute).canActivate(contextFor(request)),
    ).rejects.toBe(failure);
  });
});
