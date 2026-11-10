import { describe, expect, it } from "vitest";

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  checkPassword,
  checkPasswordConfirmation,
} from "./password-policy";

describe("checkPassword", () => {
  it("deve aceitar os limites exatos e preservar espaços", () => {
    const min = "a".repeat(PASSWORD_MIN_LENGTH);
    const max = "a".repeat(PASSWORD_MAX_LENGTH);

    expect(checkPassword(min)).toEqual({ ok: true, value: min });
    expect(checkPassword(max)).toEqual({ ok: true, value: max });
    expect(checkPassword("  spaces are ok  ")).toEqual({
      ok: true,
      value: "  spaces are ok  ",
    });
  });

  it.each([
    [null, "Enter a password."],
    ["", "Enter a password."],
    [
      "a".repeat(PASSWORD_MIN_LENGTH - 1),
      "Password must be at least 8 characters.",
    ],
    [
      "a".repeat(PASSWORD_MAX_LENGTH + 1),
      "Password must be 128 characters or fewer.",
    ],
  ])("deve rejeitar %j com a mensagem do sign-up", (value, message) => {
    expect(checkPassword(value)).toEqual({ ok: false, message });
  });
});

describe("checkPasswordConfirmation", () => {
  it("deve aceitar confirmação idêntica", () => {
    expect(checkPasswordConfirmation("password1", "password1")).toEqual({
      ok: true,
      value: "password1",
    });
  });

  it("deve exigir confirmação", () => {
    expect(checkPasswordConfirmation(null, "password1")).toEqual({
      ok: false,
      message: "Confirm your password.",
    });
    expect(checkPasswordConfirmation("", "password1")).toEqual({
      ok: false,
      message: "Confirm your password.",
    });
  });

  it("deve rejeitar confirmação diferente ou senha inválida", () => {
    expect(checkPasswordConfirmation("password2", "password1")).toEqual({
      ok: false,
      message: "Passwords do not match.",
    });
    expect(checkPasswordConfirmation("password1", null)).toEqual({
      ok: false,
      message: "Passwords do not match.",
    });
  });
});
