import { describe, expect, it } from "vitest";

import {
  EMAIL_MAX_LENGTH,
  FIRST_NAME_MAX_LENGTH,
  LAST_NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validateSignUpInput,
} from "./sign-up-input";

const validInput = {
  firstName: "  Ada ",
  lastName: " Lovelace  ",
  email: " ADA@Example.COM ",
  password: "correct horse battery staple",
  passwordConfirmation: "correct horse battery staple",
};

describe("validateSignUpInput", () => {
  it("deve normalizar nomes e e-mail e manter a senha exatamente como digitada", () => {
    const result = validateSignUpInput(validInput);

    expect(result).toEqual({
      ok: true,
      value: {
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        password: "correct horse battery staple",
        passwordConfirmation: "correct horse battery staple",
      },
    });
  });

  it("deve exigir todos os campos quando o corpo está vazio", () => {
    const result = validateSignUpInput({});

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(Object.keys(result.fieldErrors).sort()).toEqual([
        "email",
        "firstName",
        "lastName",
        "password",
        "passwordConfirmation",
      ]);
      expect(result.fieldErrors.firstName).toBe("Enter your first name.");
      expect(result.fieldErrors.email).toBe("Enter your email address.");
    }
  });

  it("deve rejeitar corpo que não é objeto", () => {
    const result = validateSignUpInput("not-an-object");

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.fieldErrors.firstName).toBeDefined();
    }
  });

  it("deve rejeitar nomes acima do limite", () => {
    const result = validateSignUpInput({
      ...validInput,
      firstName: "a".repeat(FIRST_NAME_MAX_LENGTH + 1),
      lastName: "b".repeat(LAST_NAME_MAX_LENGTH + 1),
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.fieldErrors.firstName).toBe(
        `First name must be ${FIRST_NAME_MAX_LENGTH} characters or fewer.`,
      );
      expect(result.fieldErrors.lastName).toBe(
        `Last name must be ${LAST_NAME_MAX_LENGTH} characters or fewer.`,
      );
    }
  });

  it("deve rejeitar e-mail inválido e acima do limite", () => {
    const invalid = validateSignUpInput({
      ...validInput,
      email: "ada-at-example.com",
    });

    expect(invalid.ok).toBe(false);

    if (!invalid.ok) {
      expect(invalid.fieldErrors.email).toBe("Enter a valid email address.");
    }

    const tooLong = validateSignUpInput({
      ...validInput,
      email: `${"a".repeat(EMAIL_MAX_LENGTH)}@example.com`,
    });

    expect(tooLong.ok).toBe(false);

    if (!tooLong.ok) {
      expect(tooLong.fieldErrors.email).toBe(
        `Email must be ${EMAIL_MAX_LENGTH} characters or fewer.`,
      );
    }
  });

  it("deve aplicar a política de senha de 8 a 128 caracteres", () => {
    const short = validateSignUpInput({
      ...validInput,
      password: "a".repeat(PASSWORD_MIN_LENGTH - 1),
      passwordConfirmation: "a".repeat(PASSWORD_MIN_LENGTH - 1),
    });

    expect(short.ok).toBe(false);

    if (!short.ok) {
      expect(short.fieldErrors.password).toBe(
        `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
      );
    }

    const long = validateSignUpInput({
      ...validInput,
      password: "a".repeat(PASSWORD_MAX_LENGTH + 1),
      passwordConfirmation: "a".repeat(PASSWORD_MAX_LENGTH + 1),
    });

    expect(long.ok).toBe(false);

    if (!long.ok) {
      expect(long.fieldErrors.password).toBe(
        `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`,
      );
    }
  });

  it("deve exigir confirmação idêntica à senha", () => {
    const missing = validateSignUpInput({
      ...validInput,
      passwordConfirmation: "",
    });

    expect(missing.ok).toBe(false);

    if (!missing.ok) {
      expect(missing.fieldErrors.passwordConfirmation).toBe(
        "Confirm your password.",
      );
    }

    const mismatch = validateSignUpInput({
      ...validInput,
      passwordConfirmation: "different password",
    });

    expect(mismatch.ok).toBe(false);

    if (!mismatch.ok) {
      expect(mismatch.fieldErrors.passwordConfirmation).toBe(
        "Passwords do not match.",
      );
    }
  });
});
