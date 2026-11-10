import { EMAIL_MAX_LENGTH, normalizeEmail } from "./sign-up-input";

/** Same upper bound as sign-up; it also caps the work done by the KDF. */
export const SIGN_IN_PASSWORD_MAX_LENGTH = 128;

export type SignInInput = {
  email: string;
  password: string;
};

/**
 * Parses the raw sign-in body. It returns `null` for anything malformed so the
 * caller can answer with the same generic `401` used for wrong credentials; no
 * field-level feedback is given, which keeps the endpoint free of oracles.
 * The email is normalized (trim + lowercase) like sign-up; the password is
 * kept exactly as typed.
 */
export function parseSignInInput(input: unknown): SignInInput | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return null;
  }

  const record = input as Record<string, unknown>;
  const { email: rawEmail, password } = record;

  if (typeof rawEmail !== "string" || typeof password !== "string") {
    return null;
  }

  const email = normalizeEmail(rawEmail);

  if (
    email.length === 0 ||
    email.length > EMAIL_MAX_LENGTH ||
    password.length === 0 ||
    password.length > SIGN_IN_PASSWORD_MAX_LENGTH
  ) {
    return null;
  }

  return { email, password };
}
