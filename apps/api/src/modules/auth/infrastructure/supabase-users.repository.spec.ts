import { describe, expect, it } from "vitest";

import { createSupabaseClientMock } from "../../../test/fakes/supabase-client.mock";

import { SupabaseUsersRepository } from "./supabase-users.repository";

const userId = "11111111-1111-1111-1111-111111111111";

describe("SupabaseUsersRepository", () => {
  it("deve mapear os dados básicos da pessoa", async () => {
    const mock = createSupabaseClientMock({
      data: {
        id: userId,
        first_name: "Ada",
        last_name: "Lovelace",
        email: "ada@example.com",
      },
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
});
