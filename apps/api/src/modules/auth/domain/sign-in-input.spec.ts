import { describe, expect, it } from "vitest";

import { parseSignInInput } from "./sign-in-input";

describe("parseSignInInput", () => {
  it("deve normalizar o e-mail e preservar a senha como digitada", () => {
    expect(
      parseSignInInput({ email: "  Ada@Example.COM ", password: " Secret 1 " }),
    ).toEqual({ email: "ada@example.com", password: " Secret 1 " });
  });

  it.each([
    ["corpo ausente", undefined],
    ["corpo nulo", null],
    ["corpo array", []],
    ["e-mail ausente", { password: "x" }],
    ["senha ausente", { email: "ada@example.com" }],
    ["e-mail vazio", { email: "   ", password: "x" }],
    ["senha vazia", { email: "ada@example.com", password: "" }],
    ["e-mail não string", { email: 1, password: "x" }],
    ["senha não string", { email: "ada@example.com", password: 123 }],
    [
      "senha acima do limite",
      { email: "ada@example.com", password: "a".repeat(129) },
    ],
    [
      "e-mail acima do limite",
      { email: `${"a".repeat(260)}@x.io`, password: "x" },
    ],
  ])("deve rejeitar %s", (_label, body) => {
    expect(parseSignInInput(body)).toBeNull();
  });
});
