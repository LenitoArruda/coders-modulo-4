import { describe, expect, it } from "vitest";

import { validateResetPasswordInput } from "./reset-password-input";

const valid = {
  token: "opaque-token",
  password: "new correct horse battery staple",
  passwordConfirmation: "new correct horse battery staple",
};

describe("validateResetPasswordInput", () => {
  it("deve aceitar token, senha e confirmação válidos", () => {
    expect(validateResetPasswordInput(valid)).toEqual({
      ok: true,
      value: { token: "opaque-token", password: valid.password },
    });
  });

  it("deve aparar o token e preservar a senha como digitada", () => {
    expect(
      validateResetPasswordInput({
        ...valid,
        token: "  opaque-token  ",
        password: " spaced password ",
        passwordConfirmation: " spaced password ",
      }),
    ).toEqual({
      ok: true,
      value: { token: "opaque-token", password: " spaced password " },
    });
  });

  it("deve devolver token vazio quando ausente, sem erro de campo", () => {
    const { token: _token, ...withoutToken } = valid;

    expect(validateResetPasswordInput(withoutToken)).toEqual({
      ok: true,
      value: { token: "", password: valid.password },
    });
  });

  it("deve reutilizar as mensagens do sign-up para a senha", () => {
    expect(
      validateResetPasswordInput({
        ...valid,
        password: "short",
        passwordConfirmation: "short",
      }),
    ).toEqual({
      ok: false,
      // Same as sign-up: a password that fails its own check never matches.
      fieldErrors: {
        password: "Password must be at least 8 characters.",
        passwordConfirmation: "Passwords do not match.",
      },
    });
  });

  it("deve rejeitar confirmação diferente", () => {
    expect(
      validateResetPasswordInput({ ...valid, passwordConfirmation: "other" }),
    ).toEqual({
      ok: false,
      fieldErrors: { passwordConfirmation: "Passwords do not match." },
    });
  });

  it("deve reportar senha e confirmação ausentes", () => {
    expect(validateResetPasswordInput({ token: "t" })).toEqual({
      ok: false,
      fieldErrors: {
        password: "Enter a password.",
        passwordConfirmation: "Confirm your password.",
      },
    });
  });

  it.each([undefined, null, [], "text", 42])(
    "deve tratar o corpo %j como vazio",
    (body) => {
      const result = validateResetPasswordInput(body);

      expect(result.ok).toBe(false);
    },
  );
});
