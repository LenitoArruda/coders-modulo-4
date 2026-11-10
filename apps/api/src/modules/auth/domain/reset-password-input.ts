import { checkPassword, checkPasswordConfirmation } from "./password-policy";

/**
 * Pure validation for the reset-password request. The password policy and its
 * messages are the sign-up ones. The token is only trimmed here: whether it is
 * known, unused and unexpired is decided by the use case, after the password
 * validation, so a weak password never burns the token.
 */
export type ResetPasswordInput = {
  /** Clear single-use token; an empty string when absent from the body. */
  token: string;
  password: string;
};

export type ResetPasswordFieldErrors = {
  password?: string;
  passwordConfirmation?: string;
};

export type ResetPasswordValidation =
  | { ok: true; value: ResetPasswordInput }
  | { ok: false; fieldErrors: ResetPasswordFieldErrors };

function readString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];

  return typeof value === "string" ? value : null;
}

export function validateResetPasswordInput(
  input: unknown,
): ResetPasswordValidation {
  const record =
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const fieldErrors: ResetPasswordFieldErrors = {};

  const password = checkPassword(readString(record, "password"));
  const confirmation = checkPasswordConfirmation(
    readString(record, "passwordConfirmation"),
    password.ok ? password.value : null,
  );

  if (!password.ok) {
    fieldErrors.password = password.message;
  }

  if (!confirmation.ok) {
    fieldErrors.passwordConfirmation = confirmation.message;
  }

  if (!password.ok || !confirmation.ok) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    value: {
      token: (readString(record, "token") ?? "").trim(),
      password: password.value,
    },
  };
}
