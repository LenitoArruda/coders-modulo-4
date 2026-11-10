/**
 * Password policy shared by sign-up and reset-password: 8 to 128 characters,
 * no composition rules, spaces are valid. Messages are user-facing en-US
 * strings, so both flows show exactly the same text.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordCheck =
  { ok: true; value: string } | { ok: false; message: string };

/** Validates the password exactly as typed (no trimming). */
export function checkPassword(value: string | null): PasswordCheck {
  if (value === null || value.length === 0) {
    return { ok: false, message: "Enter a password." };
  }

  if (value.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    };
  }

  if (value.length > PASSWORD_MAX_LENGTH) {
    return {
      ok: false,
      message: `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`,
    };
  }

  return { ok: true, value };
}

/**
 * Validates the confirmation against the password. A password that failed its
 * own check (`null`) can never match, so the confirmation is reported too.
 */
export function checkPasswordConfirmation(
  value: string | null,
  password: string | null,
): PasswordCheck {
  if (value === null || value.length === 0) {
    return { ok: false, message: "Confirm your password." };
  }

  if (password === null || value !== password) {
    return { ok: false, message: "Passwords do not match." };
  }

  return { ok: true, value };
}
