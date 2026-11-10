import { describe, expect, it } from "vitest";

import { createSupabaseClientMock } from "../../../test/fakes/supabase-client.mock";

import { SupabaseAuthTokensRepository } from "./supabase-auth-tokens.repository";

const userId = "11111111-1111-1111-1111-111111111111";
const expiresAt = new Date("2026-11-10T12:00:00.000Z");

describe("SupabaseAuthTokensRepository", () => {
  it("deve persistir apenas o hash do token com purpose e expiração", async () => {
    const mock = createSupabaseClientMock();
    const repository = new SupabaseAuthTokensRepository(mock.client);

    await repository.create({
      userId,
      purpose: "email_confirmation",
      tokenHash: "hashed-token",
      expiresAt,
    });

    expect(mock.calls.map((call) => call.method)).toEqual(["from", "insert"]);
    expect(mock.calls[0]?.args).toEqual(["auth_tokens"]);
    expect(mock.calls[1]?.args).toEqual([
      {
        user_id: userId,
        purpose: "email_confirmation",
        token_hash: "hashed-token",
        expires_at: expiresAt.toISOString(),
      },
    ]);
  });

  it("deve falhar quando a criação do token retorna erro", async () => {
    const mock = createSupabaseClientMock({
      error: { code: "23505" },
    });
    const repository = new SupabaseAuthTokensRepository(mock.client);

    await expect(
      repository.create({
        userId,
        purpose: "email_confirmation",
        tokenHash: "hashed-token",
        expiresAt,
      }),
    ).rejects.toThrow("Could not create auth token");
  });

  it("deve invalidar somente tokens não usados da pessoa e do purpose", async () => {
    const mock = createSupabaseClientMock();
    const repository = new SupabaseAuthTokensRepository(mock.client);

    await repository.invalidateUnused(userId, "email_confirmation");

    expect(mock.calls.map((call) => call.method)).toEqual([
      "from",
      "update",
      "eq",
      "eq",
      "is",
    ]);
    expect(mock.calls[0]?.args).toEqual(["auth_tokens"]);
    expect(mock.calls[1]?.args[0]).toMatchObject({
      used_at: expect.any(String),
    });
    expect(mock.calls[2]?.args).toEqual(["user_id", userId]);
    expect(mock.calls[3]?.args).toEqual(["purpose", "email_confirmation"]);
    expect(mock.calls[4]?.args).toEqual(["used_at", null]);
  });

  it("deve falhar quando a invalidação retorna erro", async () => {
    const mock = createSupabaseClientMock({
      error: { code: "42501" },
    });
    const repository = new SupabaseAuthTokensRepository(mock.client);

    await expect(
      repository.invalidateUnused(userId, "email_confirmation"),
    ).rejects.toThrow("Could not invalidate auth tokens");
  });
});
