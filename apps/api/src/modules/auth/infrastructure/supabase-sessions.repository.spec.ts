import { describe, expect, it } from "vitest";

import { createSupabaseClientMock } from "../../../test/fakes/supabase-client.mock";

import { SupabaseSessionsRepository } from "./supabase-sessions.repository";

const userId = "11111111-1111-1111-1111-111111111111";
const sessionId = "22222222-2222-2222-2222-222222222222";
const createdAt = new Date("2026-11-09T12:00:00.000Z");
const expiresAt = new Date("2026-11-16T12:00:00.000Z");

const row = {
  id: sessionId,
  user_id: userId,
  origin: "sign_in",
  created_at: createdAt.toISOString(),
  expires_at: expiresAt.toISOString(),
  revoked_at: null,
};

function methods(calls: { method: string }[]): string[] {
  return calls.map((call) => call.method);
}

describe("SupabaseSessionsRepository", () => {
  it("deve inserir a sessão com origin e expiração e mapear o registro", async () => {
    const mock = createSupabaseClientMock({ data: row, error: null });
    const repository = new SupabaseSessionsRepository(mock.client);

    const session = await repository.create({
      userId,
      origin: "sign_in",
      expiresAt,
    });

    expect(methods(mock.calls)).toEqual(["from", "insert", "select"]);
    expect(mock.calls[0]?.args).toEqual(["sessions"]);
    expect(mock.calls[1]?.args).toEqual([
      {
        user_id: userId,
        origin: "sign_in",
        expires_at: expiresAt.toISOString(),
      },
    ]);
    expect(session).toEqual({
      id: sessionId,
      userId,
      origin: "sign_in",
      createdAt,
      expiresAt,
      revokedAt: null,
    });
  });

  it("deve falhar com mensagem estável quando a inserção retorna erro", async () => {
    const mock = createSupabaseClientMock({
      data: null,
      error: { code: "23505" },
    });
    const repository = new SupabaseSessionsRepository(mock.client);

    await expect(
      repository.create({ userId, origin: "sign_in", expiresAt }),
    ).rejects.toThrow("Could not create session");
  });

  it("deve revogar apenas sessões ativas da pessoa exceto a nova", async () => {
    const mock = createSupabaseClientMock();
    const repository = new SupabaseSessionsRepository(mock.client);

    await repository.revokeAllActiveExcept(userId, sessionId);

    expect(methods(mock.calls)).toEqual([
      "from",
      "update",
      "eq",
      "is",
      "gt",
      "neq",
    ]);
    expect(mock.calls[1]?.args[0]).toMatchObject({
      revoked_at: expect.any(String),
    });
    expect(mock.calls[2]?.args).toEqual(["user_id", userId]);
    expect(mock.calls[3]?.args).toEqual(["revoked_at", null]);
    expect(mock.calls[4]?.args[0]).toBe("expires_at");
    expect(mock.calls[5]?.args).toEqual(["id", sessionId]);
  });

  it("deve falhar quando a revogação retorna erro", async () => {
    const mock = createSupabaseClientMock({
      error: { code: "42501" },
    });
    const repository = new SupabaseSessionsRepository(mock.client);

    await expect(
      repository.revokeAllActiveExcept(userId, sessionId),
    ).rejects.toThrow("Could not revoke sessions");
  });

  it("deve buscar somente sessões ativas por id", async () => {
    const mock = createSupabaseClientMock({ data: row, error: null });
    const repository = new SupabaseSessionsRepository(mock.client);

    const session = await repository.findActiveById(sessionId);

    expect(methods(mock.calls)).toEqual(["from", "select", "eq", "is", "gt"]);
    expect(mock.calls[2]?.args).toEqual(["id", sessionId]);
    expect(mock.calls[3]?.args).toEqual(["revoked_at", null]);
    expect(mock.calls[4]?.args[0]).toBe("expires_at");
    expect(session?.id).toBe(sessionId);
  });

  it("deve retornar nulo quando a sessão não é encontrada", async () => {
    const mock = createSupabaseClientMock({ data: null, error: null });
    const repository = new SupabaseSessionsRepository(mock.client);

    await expect(repository.findActiveById(sessionId)).resolves.toBeNull();
  });

  it("deve falhar quando a busca retorna erro", async () => {
    const mock = createSupabaseClientMock({
      error: { code: "08006" },
    });
    const repository = new SupabaseSessionsRepository(mock.client);

    await expect(repository.findActiveById(sessionId)).rejects.toThrow(
      "Could not load session",
    );
  });

  it("deve revogar todas as sessões ativas da pessoa sem exceção", async () => {
    const mock = createSupabaseClientMock();
    const repository = new SupabaseSessionsRepository(mock.client);

    await repository.revokeAllActive(userId);

    expect(methods(mock.calls)).toEqual(["from", "update", "eq", "is", "gt"]);
    expect(mock.calls[0]?.args).toEqual(["sessions"]);
    expect(mock.calls[1]?.args[0]).toMatchObject({
      revoked_at: expect.any(String),
    });
    expect(mock.calls[2]?.args).toEqual(["user_id", userId]);
    expect(mock.calls[3]?.args).toEqual(["revoked_at", null]);
    expect(mock.calls[4]?.args[0]).toBe("expires_at");
  });

  it("deve falhar quando a revogação total retorna erro", async () => {
    const mock = createSupabaseClientMock({ error: { code: "42501" } });
    const repository = new SupabaseSessionsRepository(mock.client);

    await expect(repository.revokeAllActive(userId)).rejects.toThrow(
      "Could not revoke sessions",
    );
  });
});
