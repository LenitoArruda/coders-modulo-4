import { describe, expect, it } from "vitest";

import { createPgPoolMock, pgError } from "../../../test/fakes/pg-pool.mock";

import { PostgresAuthTokensRepository } from "./postgres-auth-tokens.repository";

const userId = "11111111-1111-1111-1111-111111111111";
const expiresAt = new Date("2026-11-10T12:00:00.000Z");
const createdAt = new Date("2026-11-09T12:00:00.000Z");

describe("PostgresAuthTokensRepository", () => {
  it("deve persistir apenas o hash do token com purpose e expiração", async () => {
    const mock = createPgPoolMock({ rowCount: 1 });
    const repository = new PostgresAuthTokensRepository(mock.pool);

    await repository.create({
      userId,
      purpose: "email_confirmation",
      tokenHash: "hashed-token",
      expiresAt,
    });

    expect(mock.calls[0]?.text).toContain("insert into public.auth_tokens");
    expect(mock.calls[0]?.params).toEqual([
      userId,
      "email_confirmation",
      "hashed-token",
      expiresAt,
    ]);
  });

  it("deve falhar quando a criação do token lança erro", async () => {
    const mock = createPgPoolMock(pgError("23505"));
    const repository = new PostgresAuthTokensRepository(mock.pool);

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
    const mock = createPgPoolMock({ rowCount: 1 });
    const repository = new PostgresAuthTokensRepository(mock.pool);

    await repository.invalidateUnused(userId, "email_confirmation");

    expect(mock.calls[0]?.text).toContain("set used_at = now()");
    expect(mock.calls[0]?.text).toContain(
      "where user_id = $1 and purpose = $2 and used_at is null",
    );
    expect(mock.calls[0]?.params).toEqual([userId, "email_confirmation"]);
  });

  it("deve invalidar tokens pendentes exceto o hash recém-criado", async () => {
    const mock = createPgPoolMock({ rowCount: 2 });
    const repository = new PostgresAuthTokensRepository(mock.pool);

    await repository.invalidateUnusedExcept(
      userId,
      "password_reset",
      "new-hash",
    );

    expect(mock.calls[0]?.text).toContain("token_hash <> $3");
    expect(mock.calls[0]?.params).toEqual([
      userId,
      "password_reset",
      "new-hash",
    ]);
  });

  it("deve falhar quando a invalidação lança erro", async () => {
    const mock = createPgPoolMock(pgError("42501"));
    const repository = new PostgresAuthTokensRepository(mock.pool);

    await expect(
      repository.invalidateUnused(userId, "email_confirmation"),
    ).rejects.toThrow("Could not invalidate auth tokens");
  });

  it("deve buscar o token pelo hash e mapear o estado de uso", async () => {
    const mock = createPgPoolMock({
      rows: [
        {
          id: "token-id",
          user_id: userId,
          purpose: "email_confirmation",
          token_hash: "hashed-token",
          expires_at: expiresAt,
          used_at: null,
          created_at: createdAt,
        },
      ],
    });
    const repository = new PostgresAuthTokensRepository(mock.pool);

    await expect(repository.findByHash("hashed-token")).resolves.toEqual({
      id: "token-id",
      userId,
      purpose: "email_confirmation",
      tokenHash: "hashed-token",
      expiresAt,
      usedAt: null,
      createdAt,
    });
    expect(mock.calls[0]?.text).toContain("where token_hash = $1");
    expect(mock.calls[0]?.params).toEqual(["hashed-token"]);
  });

  it("deve retornar nulo quando o hash não existe", async () => {
    const mock = createPgPoolMock({ rows: [] });
    const repository = new PostgresAuthTokensRepository(mock.pool);

    await expect(repository.findByHash("missing")).resolves.toBeNull();
  });

  it("deve falhar quando a busca por hash lança erro", async () => {
    const mock = createPgPoolMock(pgError("08006"));
    const repository = new PostgresAuthTokensRepository(mock.pool);

    await expect(repository.findByHash("hashed-token")).rejects.toThrow(
      "Could not load auth token",
    );
  });

  it("deve consumir somente token ainda não usado", async () => {
    const mock = createPgPoolMock({ rowCount: 1 });
    const repository = new PostgresAuthTokensRepository(mock.pool);

    await expect(repository.consume("token-id")).resolves.toBe(true);
    expect(mock.calls[0]?.text).toContain("set used_at = now()");
    expect(mock.calls[0]?.text).toContain("where id = $1 and used_at is null");
    expect(mock.calls[0]?.params).toEqual(["token-id"]);
  });

  it("deve retornar false quando o token já foi consumido", async () => {
    const mock = createPgPoolMock({ rowCount: 0 });
    const repository = new PostgresAuthTokensRepository(mock.pool);

    await expect(repository.consume("token-id")).resolves.toBe(false);
  });

  it("deve falhar quando o consumo lança erro", async () => {
    const mock = createPgPoolMock(pgError("42501"));
    const repository = new PostgresAuthTokensRepository(mock.pool);

    await expect(repository.consume("token-id")).rejects.toThrow(
      "Could not consume auth token",
    );
  });
});
