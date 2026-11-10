import { describe, expect, it } from "vitest";

import { EMAIL_MAX_LENGTH } from "./sign-up-input";
import { validateForgotPasswordInput } from "./forgot-password-input";

describe("validateForgotPasswordInput", () => {
  it("deve normalizar o e-mail removendo espaços e caixa", () => {
    expect(
      validateForgotPasswordInput({ email: "  ADA@Example.COM " }),
    ).toEqual({
      ok: true,
      value: { email: "ada@example.com" },
    });
  });

  it("deve exigir o e-mail quando ausente ou vazio", () => {
    for (const input of [
      undefined,
      null,
      {},
      { email: "" },
      { email: "   " },
    ]) {
      expect(validateForgotPasswordInput(input)).toEqual({
        ok: false,
        fieldErrors: { email: "Enter your email address." },
      });
    }
  });

  it("deve rejeitar e-mail sintaticamente inválido", () => {
    for (const email of ["not-an-email", "ada@", "@example.com", "a b@c.com"]) {
      expect(validateForgotPasswordInput({ email })).toEqual({
        ok: false,
        fieldErrors: { email: "Enter a valid email address." },
      });
    }
  });

  it("deve rejeitar e-mail maior que o limite", () => {
    const email = `${"a".repeat(EMAIL_MAX_LENGTH)}@example.com`;

    expect(validateForgotPasswordInput({ email })).toEqual({
      ok: false,
      fieldErrors: {
        email: `Email must be ${EMAIL_MAX_LENGTH} characters or fewer.`,
      },
    });
  });

  it("deve ignorar campos desconhecidos e tipos não-string", () => {
    expect(
      validateForgotPasswordInput({
        email: "ada@example.com",
        extra: "ignored",
      }),
    ).toEqual({ ok: true, value: { email: "ada@example.com" } });

    expect(validateForgotPasswordInput({ email: 42 })).toEqual({
      ok: false,
      fieldErrors: { email: "Enter your email address." },
    });
  });
});
