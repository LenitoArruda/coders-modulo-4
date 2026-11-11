import { describe, expect, it } from "vitest";

import type { AuthUser } from "../domain/auth-user";

import { GetCurrentUserUseCase } from "./get-current-user.use-case";

const user: AuthUser = {
  id: "11111111-1111-1111-1111-111111111111",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
};

describe("GetCurrentUserUseCase", () => {
  it("deve devolver a mesma referência recebida do guard", () => {
    const useCase = new GetCurrentUserUseCase();

    expect(useCase.execute(user)).toBe(user);
  });

  it("não deve declarar dependência de repositório ou de qualquer porta", () => {
    // Zero parâmetros de construtor: o `AuthUser` vem do guard, sem releitura.
    expect(GetCurrentUserUseCase.length).toBe(0);
  });
});
