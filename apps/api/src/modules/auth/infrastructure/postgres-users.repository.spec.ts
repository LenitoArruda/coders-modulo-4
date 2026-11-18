import { describe, expect, it } from "vitest";

import { createPgPoolMock, pgError } from "../../../test/fakes/pg-pool.mock";
import { DuplicateEmailError } from "../domain/sign-up.errors";

import { PostgresUsersRepository } from "./postgres-users.repository";

const userId = "11111111-1111-1111-1111-111111111111";
const confirmedAt = new Date("2026-11-09T12:00:00.000Z");

const userRow = {
  id: userId,
  first_name: "Ada",
  last_name: "Lovelace",
  email: "ada@example.com",
};

const accountRow = {
  ...userRow,
  email_confirmed_at: confirmedAt,
  password_hash: "stored-hash",
};

describe("PostgresUsersRepository", () => {
  it("deve mapear os dados básicos da pessoa", async () => {
    const mock = createPgPoolMock({ rows: [userRow] });
    const repository = new PostgresUsersRepository(mock.pool);

    await expect(repository.findById(userId)).resolves.toEqual({
      id: userId,
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
    });
    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0]?.text).toContain("from public.users where id = $1");
    expect(mock.calls[0]?.params).toEqual([userId]);
  });

  it("deve retornar nulo quando a pessoa não existe", async () => {
    const mock = createPgPoolMock({ rows: [] });
    const repository = new PostgresUsersRepository(mock.pool);

    await expect(repository.findById(userId)).resolves.toBeNull();
  });

  it("deve falhar quando a busca lança erro do banco", async () => {
    const mock = createPgPoolMock(pgError("08006"));
    const repository = new PostgresUsersRepository(mock.pool);

    await expect(repository.findById(userId)).rejects.toThrow(
      "Could not load user",
    );
  });

  it("deve buscar por e-mail e mapear o estado de confirmação", async () => {
    const mock = createPgPoolMock({ rows: [accountRow] });
    const repository = new PostgresUsersRepository(mock.pool);

    await expect(repository.findByEmail("ada@example.com")).resolves.toEqual({
      id: userId,
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      emailConfirmedAt: confirmedAt,
      passwordHash: "stored-hash",
    });
    expect(mock.calls[0]?.text).toContain("email_confirmed_at");
    expect(mock.calls[0]?.text).toContain("where email = $1");
    expect(mock.calls[0]?.params).toEqual(["ada@example.com"]);
  });

  it("deve retornar nulo quando o e-mail não existe", async () => {
    const mock = createPgPoolMock({ rows: [] });
    const repository = new PostgresUsersRepository(mock.pool);

    await expect(
      repository.findByEmail("missing@example.com"),
    ).resolves.toBeNull();
  });

  it("deve criar a conta e mapear o registro retornado", async () => {
    const mock = createPgPoolMock({
      rows: [{ ...accountRow, email_confirmed_at: null }],
    });
    const repository = new PostgresUsersRepository(mock.pool);

    const account = await repository.create({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      passwordHash: "fake-hash",
    });

    expect(mock.calls[0]?.text).toContain("insert into public.users");
    expect(mock.calls[0]?.text).toContain("returning");
    expect(mock.calls[0]?.params).toEqual([
      "Ada",
      "Lovelace",
      "ada@example.com",
      "fake-hash",
    ]);
    expect(account).toEqual({
      id: userId,
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      emailConfirmedAt: null,
      passwordHash: "stored-hash",
    });
  });

  it("deve sinalizar e-mail duplicado sem expor detalhes do banco", async () => {
    const mock = createPgPoolMock(
      pgError("23505", "duplicate key ada@example.com"),
    );
    const repository = new PostgresUsersRepository(mock.pool);

    await expect(
      repository.create({
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        passwordHash: "fake-hash",
      }),
    ).rejects.toBeInstanceOf(DuplicateEmailError);
  });

  it("deve falhar com mensagem estável em outros erros de criação", async () => {
    const mock = createPgPoolMock(pgError("42501", "permission denied"));
    const repository = new PostgresUsersRepository(mock.pool);

    await expect(
      repository.create({
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        passwordHash: "fake-hash",
      }),
    ).rejects.toThrow("Could not create user");
  });

  it("deve buscar a conta por id com o estado de confirmação", async () => {
    const mock = createPgPoolMock({ rows: [accountRow] });
    const repository = new PostgresUsersRepository(mock.pool);

    await expect(repository.findAccountById(userId)).resolves.toEqual({
      id: userId,
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      emailConfirmedAt: confirmedAt,
      passwordHash: "stored-hash",
    });
    expect(mock.calls[0]?.text).toContain("email_confirmed_at");
    expect(mock.calls[0]?.params).toEqual([userId]);
  });

  it("deve retornar nulo quando a conta não existe por id", async () => {
    const mock = createPgPoolMock({ rows: [] });
    const repository = new PostgresUsersRepository(mock.pool);

    await expect(repository.findAccountById(userId)).resolves.toBeNull();
  });

  it("deve falhar quando a busca da conta por id lança erro", async () => {
    const mock = createPgPoolMock(pgError("08006"));
    const repository = new PostgresUsersRepository(mock.pool);

    await expect(repository.findAccountById(userId)).rejects.toThrow(
      "Could not load user account",
    );
  });

  it("deve confirmar o e-mail só quando ainda não há timestamp", async () => {
    const mock = createPgPoolMock({ rowCount: 1 });
    const repository = new PostgresUsersRepository(mock.pool);

    await expect(repository.confirmEmail(userId)).resolves.toBe(true);
    expect(mock.calls[0]?.text).toContain(
      "set email_confirmed_at = now() where id = $1 and email_confirmed_at is null",
    );
    expect(mock.calls[0]?.params).toEqual([userId]);
  });

  it("deve retornar false quando a conta já estava confirmada", async () => {
    const mock = createPgPoolMock({ rowCount: 0 });
    const repository = new PostgresUsersRepository(mock.pool);

    await expect(repository.confirmEmail(userId)).resolves.toBe(false);
  });

  it("deve falhar quando a confirmação do e-mail lança erro", async () => {
    const mock = createPgPoolMock(pgError("42501"));
    const repository = new PostgresUsersRepository(mock.pool);

    await expect(repository.confirmEmail(userId)).rejects.toThrow(
      "Could not confirm user email",
    );
  });

  it("deve atualizar somente o hash da senha da pessoa", async () => {
    const mock = createPgPoolMock({ rowCount: 1 });
    const repository = new PostgresUsersRepository(mock.pool);

    await repository.updatePassword(userId, "new-password-hash-value-123");

    expect(mock.calls[0]?.text).toContain(
      "update public.users set password_hash = $2 where id = $1",
    );
    expect(mock.calls[0]?.params).toEqual([
      userId,
      "new-password-hash-value-123",
    ]);
  });

  it("deve falhar quando a atualização da senha lança erro", async () => {
    const mock = createPgPoolMock(pgError("42501"));
    const repository = new PostgresUsersRepository(mock.pool);

    await expect(
      repository.updatePassword(userId, "new-password-hash-value-123"),
    ).rejects.toThrow("Could not update user password");
  });
});
