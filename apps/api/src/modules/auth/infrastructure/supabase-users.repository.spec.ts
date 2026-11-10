import { describe, expect, it } from "vitest";

import { createSupabaseClientMock } from "../../../test/fakes/supabase-client.mock";
import { DuplicateEmailError } from "../domain/sign-up.errors";

import { SupabaseUsersRepository } from "./supabase-users.repository";

const userId = "11111111-1111-1111-1111-111111111111";

const userRow = {
  id: userId,
  first_name: "Ada",
  last_name: "Lovelace",
  email: "ada@example.com",
};

const accountRow = {
  ...userRow,
  email_confirmed_at: "2026-11-09T12:00:00.000Z",
  password_hash: "stored-hash",
};

describe("SupabaseUsersRepository", () => {
  it("deve mapear os dados básicos da pessoa", async () => {
    const mock = createSupabaseClientMock({
      data: userRow,
      error: null,
    });
    const repository = new SupabaseUsersRepository(mock.client);

    await expect(repository.findById(userId)).resolves.toEqual({
      id: userId,
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
    });
    expect(mock.calls.map((call) => call.method)).toEqual([
      "from",
      "select",
      "eq",
    ]);
    expect(mock.calls[0]?.args).toEqual(["users"]);
    expect(mock.calls[2]?.args).toEqual(["id", userId]);
  });

  it("deve retornar nulo quando a pessoa não existe", async () => {
    const mock = createSupabaseClientMock({ data: null, error: null });
    const repository = new SupabaseUsersRepository(mock.client);

    await expect(repository.findById(userId)).resolves.toBeNull();
  });

  it("deve falhar quando a busca retorna erro", async () => {
    const mock = createSupabaseClientMock({
      error: { code: "08006" },
    });
    const repository = new SupabaseUsersRepository(mock.client);

    await expect(repository.findById(userId)).rejects.toThrow(
      "Could not load user",
    );
  });

  it("deve buscar por e-mail e mapear o estado de confirmação", async () => {
    const mock = createSupabaseClientMock({
      data: accountRow,
      error: null,
    });
    const repository = new SupabaseUsersRepository(mock.client);

    await expect(repository.findByEmail("ada@example.com")).resolves.toEqual({
      id: userId,
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      emailConfirmedAt: new Date("2026-11-09T12:00:00.000Z"),
      passwordHash: "stored-hash",
    });
    expect(mock.calls.map((call) => call.method)).toEqual([
      "from",
      "select",
      "eq",
    ]);
    expect(mock.calls[1]?.args[0]).toContain("email_confirmed_at");
    expect(mock.calls[2]?.args).toEqual(["email", "ada@example.com"]);
  });

  it("deve retornar nulo quando o e-mail não existe", async () => {
    const mock = createSupabaseClientMock({ data: null, error: null });
    const repository = new SupabaseUsersRepository(mock.client);

    await expect(
      repository.findByEmail("missing@example.com"),
    ).resolves.toBeNull();
  });

  it("deve criar a conta e mapear o registro retornado", async () => {
    const mock = createSupabaseClientMock({
      data: { ...accountRow, email_confirmed_at: null },
      error: null,
    });
    const repository = new SupabaseUsersRepository(mock.client);

    const account = await repository.create({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      passwordHash: "fake-hash",
    });

    expect(mock.calls.map((call) => call.method)).toEqual([
      "from",
      "insert",
      "select",
    ]);
    expect(mock.calls[0]?.args).toEqual(["users"]);
    expect(mock.calls[1]?.args).toEqual([
      {
        first_name: "Ada",
        last_name: "Lovelace",
        email: "ada@example.com",
        password_hash: "fake-hash",
      },
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
    const mock = createSupabaseClientMock({
      data: null,
      error: { code: "23505" },
    });
    const repository = new SupabaseUsersRepository(mock.client);

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
    const mock = createSupabaseClientMock({
      data: null,
      error: { code: "42501" },
    });
    const repository = new SupabaseUsersRepository(mock.client);

    await expect(
      repository.create({
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        passwordHash: "fake-hash",
      }),
    ).rejects.toThrow("Could not create user");
  });
});
