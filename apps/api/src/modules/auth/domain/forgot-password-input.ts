import { EMAIL_MAX_LENGTH, normalizeEmail } from "./sign-up-input";

/**
 * Pure validation for the forgot-password request. The email is normalized
 * (trimmed and lowercased) exactly like sign-up so lookups are consistent.
 * Messages are user-facing en-US strings, one per field.
 */
export type ForgotPasswordInput = {
  email: string;
};

export type ForgotPasswordFieldErrors = Partial<
  Record<keyof ForgotPasswordInput, string>
>;

export type ForgotPasswordValidation =
  | { ok: true; value: ForgotPasswordInput }
  | { ok: false; fieldErrors: ForgotPasswordFieldErrors };

/** Matches the `users.email_format` constraint in the database schema. */
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Validates the raw request body and returns the normalized email. A malformed
 * address yields a field error without revealing whether the account exists.
 */
export function validateForgotPasswordInput(
  input: unknown,
): ForgotPasswordValidation {
  const record =
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const raw = record.email;

  if (typeof raw !== "string" || raw.trim().length === 0) {
    return {
      ok: false,
      fieldErrors: { email: "Enter your email address." },
    };
  }

  const email = normalizeEmail(raw);

  if (email.length > EMAIL_MAX_LENGTH) {
    return {
      ok: false,
      fieldErrors: {
        email: `Email must be ${EMAIL_MAX_LENGTH} characters or fewer.`,
      },
    };
  }

  if (!EMAIL_PATTERN.test(email)) {
    return {
      ok: false,
      fieldErrors: { email: "Enter a valid email address." },
    };
  }

  return { ok: true, value: { email } };
}
