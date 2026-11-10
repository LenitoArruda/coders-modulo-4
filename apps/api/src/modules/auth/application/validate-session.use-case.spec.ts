import { describe, expect, it } from "vitest";

import type { AuthUser } from "../domain/auth-user";
import { InvalidSessionError } from "../domain/invalid-session.error";

import { ValidateSessionUseCase } from "./validate-session.use-case";
import { InMemorySessionsRepository } from "../../../test/fakes/in-memory-sessions.repository";
import { InMemoryUsersRepository } from "../../../test/fakes/in-memory-users.repository";
import { FakeSessionToken } from "../../../test/fakes/fake-session-token";

const user: AuthUser = {
  id: "11111111-1111-1111-1111-111111111111",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
};

describe("ValidateSessionUseCase", () => {
  it("deve retornar os dados básicos com token válido e sessão ativa", async () => {
    const sessions = new InMemorySessionsRepository();
    const session = sessions.seed({
      userId: user.id,
      origin: "sign_in",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 3_600_000),
      revokedAt: null,
    });
    const users = new InMemoryUsersRepository();
    users.seed(user);
    const tokens = new FakeSessionToken();
    tokens.verifyResult = { userId: user.id, sessionId: session.id };
    const useCase = new ValidateSessionUseCase(tokens, sessions, users);

    await expect(useCase.execute("any-token")).resolves.toEqual(user);
  });

  it("deve falhar quando o token é inválido ou expirado", async () => {
    const tokens = new FakeSessionToken();
    tokens.verifyResult = new InvalidSessionError();
    const useCase = new ValidateSessionUseCase(
      tokens,
      new InMemorySessionsRepository(),
      new InMemoryUsersRepository(),
    );

    await expect(useCase.execute("bad-token")).rejects.toBeInstanceOf(
      InvalidSessionError,
    );
  });

  it("deve falhar quando a sessão não existe", async () => {
    const tokens = new FakeSessionToken();
    tokens.verifyResult = {
      userId: user.id,
      sessionId: "99999999-9999-9999-9999-999999999999",
    };
    const useCase = new ValidateSessionUseCase(
      tokens,
      new InMemorySessionsRepository(),
      new InMemoryUsersRepository(),
    );

    await expect(useCase.execute("any-token")).rejects.toBeInstanceOf(
      InvalidSessionError,
    );
  });

  it("deve falhar quando a sessão está revogada mesmo com assinatura válida", async () => {
    const sessions = new InMemorySessionsRepository();
    const session = sessions.seed({
      userId: user.id,
      origin: "sign_in",
      createdAt: new Date(Date.now() - 60_000),
      expiresAt: new Date(Date.now() + 3_600_000),
      revokedAt: new Date(),
    });
    const tokens = new FakeSessionToken();
    tokens.verifyResult = { userId: user.id, sessionId: session.id };
    const useCase = new ValidateSessionUseCase(
      tokens,
      sessions,
      new InMemoryUsersRepository(),
    );

    await expect(useCase.execute("any-token")).rejects.toBeInstanceOf(
      InvalidSessionError,
    );
  });

  it("deve falhar quando a sessão está expirada mesmo com assinatura válida", async () => {
    const sessions = new InMemorySessionsRepository();
    const session = sessions.seed({
      userId: user.id,
      origin: "sign_in",
      createdAt: new Date(Date.now() - 7_200_000),
      expiresAt: new Date(Date.now() - 60_000),
      revokedAt: null,
    });
    const tokens = new FakeSessionToken();
    tokens.verifyResult = { userId: user.id, sessionId: session.id };
    const useCase = new ValidateSessionUseCase(
      tokens,
      sessions,
      new InMemoryUsersRepository(),
    );

    await expect(useCase.execute("any-token")).rejects.toBeInstanceOf(
      InvalidSessionError,
    );
  });

  it("deve falhar quando o sub do token diverge do dono da sessão", async () => {
    const sessions = new InMemorySessionsRepository();
    const session = sessions.seed({
      userId: user.id,
      origin: "sign_in",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 3_600_000),
      revokedAt: null,
    });
    const tokens = new FakeSessionToken();
    tokens.verifyResult = {
      userId: "22222222-2222-2222-2222-222222222222",
      sessionId: session.id,
    };
    const useCase = new ValidateSessionUseCase(
      tokens,
      sessions,
      new InMemoryUsersRepository(),
    );

    await expect(useCase.execute("any-token")).rejects.toBeInstanceOf(
      InvalidSessionError,
    );
  });

  it("deve falhar quando o usuário da sessão não existe mais", async () => {
    const sessions = new InMemorySessionsRepository();
    const session = sessions.seed({
      userId: user.id,
      origin: "sign_in",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 3_600_000),
      revokedAt: null,
    });
    const tokens = new FakeSessionToken();
    tokens.verifyResult = { userId: user.id, sessionId: session.id };
    const useCase = new ValidateSessionUseCase(
      tokens,
      sessions,
      new InMemoryUsersRepository(),
    );

    await expect(useCase.execute("any-token")).rejects.toBeInstanceOf(
      InvalidSessionError,
    );
  });
});
