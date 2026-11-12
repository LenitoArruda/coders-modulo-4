import { describe, expect, it } from "vitest";

import { createPgPoolMock, pgError } from "../../../test/fakes/pg-pool.mock";

import { PostgresSessionsRepository } from "./postgres-sessions.repository";

const userId = "11111111-1111-1111-1111-111111111111";
const sessionId = "22222222-2222-2222-2222-222222222222";
const createdAt = new Date("2026-11-09T12:00:00.000Z");
const expiresAt = new Date("2026-11-16T12:00:00.000Z");

const row = {
  id: sessionId,
  user_id: userId,
  origin: "sign_in",
  created_at: createdAt,
  expires_at: expiresAt,
  revoked_at: null,
};

describe("PostgresSessionsRepository", () => {
  it("deve inserir a sessão com origin e expiração e mapear o registro", async () => {
    const mock = createPgPoolMock({ rows: [row] });
    const repository = new PostgresSessionsRepository(mock.pool);

    const session = await repository.create({
      userId,
      origin: "sign_in",
      expiresAt,
    });

    expect(mock.calls[0]?.text).toContain("insert into public.sessions");
    expect(mock.calls[0]?.params).toEqual([userId, "sign_in", expiresAt]);
    expect(session).toEqual({
      id: sessionId,
      userId,
      origin: "sign_in",
      createdAt,
      expiresAt,
      revokedAt: null,
    });
  });

  it("deve falhar com mensagem estável quando a inserção lança erro", async () => {
    const mock = createPgPoolMock(pgError("23505"));
    const repository = new PostgresSessionsRepository(mock.pool);

    await expect(
      repository.create({ userId, origin: "sign_in", expiresAt }),
    ).rejects.toThrow("Could not create session");
  });

  it("deve revogar apenas sessões ativas da pessoa exceto a nova", async () => {
    const mock = createPgPoolMock({ rowCount: 1 });
    const repository = new PostgresSessionsRepository(mock.pool);

    await repository.revokeAllActiveExcept(userId, sessionId);

    expect(mock.calls[0]?.text).toContain("set revoked_at = now()");
    expect(mock.calls[0]?.text).toContain("revoked_at is null");
    expect(mock.calls[0]?.text).toContain("expires_at > now()");
    expect(mock.calls[0]?.text).toContain("id <> $2");
    expect(mock.calls[0]?.params).toEqual([userId, sessionId]);
  });

  it("deve falhar quando a revogação lança erro", async () => {
    const mock = createPgPoolMock(pgError("42501"));
    const repository = new PostgresSessionsRepository(mock.pool);

    await expect(
      repository.revokeAllActiveExcept(userId, sessionId),
    ).rejects.toThrow("Could not revoke sessions");
  });

  it("deve buscar somente sessões ativas por id", async () => {
    const mock = createPgPoolMock({ rows: [row] });
    const repository = new PostgresSessionsRepository(mock.pool);

    const session = await repository.findActiveById(sessionId);

    expect(mock.calls[0]?.text).toContain("revoked_at is null");
    expect(mock.calls[0]?.text).toContain("expires_at > now()");
    expect(mock.calls[0]?.params).toEqual([sessionId]);
    expect(session?.id).toBe(sessionId);
  });

  it("deve retornar nulo quando a sessão não é encontrada", async () => {
    const mock = createPgPoolMock({ rows: [] });
    const repository = new PostgresSessionsRepository(mock.pool);

    await expect(repository.findActiveById(sessionId)).resolves.toBeNull();
  });

  it("deve falhar quando a busca lança erro", async () => {
    const mock = createPgPoolMock(pgError("08006"));
    const repository = new PostgresSessionsRepository(mock.pool);

    await expect(repository.findActiveById(sessionId)).rejects.toThrow(
      "Could not load session",
    );
  });

  it("deve revogar todas as sessões ativas da pessoa sem exceção", async () => {
    const mock = createPgPoolMock({ rowCount: 2 });
    const repository = new PostgresSessionsRepository(mock.pool);

    await repository.revokeAllActive(userId);

    expect(mock.calls[0]?.text).toContain("update public.sessions");
    expect(mock.calls[0]?.text).toContain("set revoked_at = now()");
    expect(mock.calls[0]?.text).not.toContain("id <>");
    expect(mock.calls[0]?.params).toEqual([userId]);
  });

  it("deve falhar quando a revogação total lança erro", async () => {
    const mock = createPgPoolMock(pgError("42501"));
    const repository = new PostgresSessionsRepository(mock.pool);

    await expect(repository.revokeAllActive(userId)).rejects.toThrow(
      "Could not revoke sessions",
    );
  });

  it("deve revogar uma sessão só da própria pessoa", async () => {
    const mock = createPgPoolMock({ rowCount: 1 });
    const repository = new PostgresSessionsRepository(mock.pool);

    await repository.revoke(userId, sessionId);

    expect(mock.calls[0]?.text).toContain(
      "where id = $1 and user_id = $2 and revoked_at is null",
    );
    expect(mock.calls[0]?.params).toEqual([sessionId, userId]);
  });

  it("deve falhar quando a revogação de uma sessão lança erro", async () => {
    const mock = createPgPoolMock(pgError("42501"));
    const repository = new PostgresSessionsRepository(mock.pool);

    await expect(repository.revoke(userId, sessionId)).rejects.toThrow(
      "Could not revoke session",
    );
  });
});
