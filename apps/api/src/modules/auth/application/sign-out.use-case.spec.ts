import { describe, expect, it } from "vitest";

import { FakeSessionToken } from "../../../test/fakes/fake-session-token";
import { InMemorySessionsRepository } from "../../../test/fakes/in-memory-sessions.repository";
import { InvalidSessionError } from "../domain/invalid-session.error";

import { SignOutUseCase } from "./sign-out.use-case";

const userId = "11111111-1111-1111-1111-111111111111";

function seedSession(sessions: InMemorySessionsRepository) {
  return sessions.seed({
    userId,
    origin: "sign_in",
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 3_600_000),
    revokedAt: null,
  });
}

describe("SignOutUseCase", () => {
  it("deve revogar a sessão do token e deixá-la inativa", async () => {
    const sessions = new InMemorySessionsRepository();
    const session = seedSession(sessions);
    const tokens = new FakeSessionToken();
    tokens.verifyResult = { userId, sessionId: session.id };

    await new SignOutUseCase(tokens, sessions).execute("token");

    await expect(sessions.findActiveById(session.id)).resolves.toBeNull();
  });

  it("não deve revogar outra sessão do mesmo usuário", async () => {
    const sessions = new InMemorySessionsRepository();
    const current = seedSession(sessions);
    const other = seedSession(sessions);
    const tokens = new FakeSessionToken();
    tokens.verifyResult = { userId, sessionId: current.id };

    await new SignOutUseCase(tokens, sessions).execute("token");

    await expect(sessions.findActiveById(other.id)).resolves.not.toBeNull();
  });

  it("deve ser idempotente", async () => {
    const sessions = new InMemorySessionsRepository();
    const session = seedSession(sessions);
    const tokens = new FakeSessionToken();
    tokens.verifyResult = { userId, sessionId: session.id };
    const useCase = new SignOutUseCase(tokens, sessions);

    await useCase.execute("token");

    await expect(useCase.execute("token")).resolves.toBeUndefined();
  });

  it("deve falhar com token inválido", async () => {
    const tokens = new FakeSessionToken();
    tokens.verifyResult = new InvalidSessionError();

    await expect(
      new SignOutUseCase(tokens, new InMemorySessionsRepository()).execute("x"),
    ).rejects.toBeInstanceOf(InvalidSessionError);
  });
});
