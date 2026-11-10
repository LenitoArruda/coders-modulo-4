/**
 * Pure sign-up validation and normalization. It lives in the domain layer so
 * the rules are testable without HTTP, framework or database. Messages are
 * user-facing en-US strings returned one per field.
 */
export const FIRST_NAME_MAX_LENGTH = 100;
export const LAST_NAME_MAX_LENGTH = 100;
export const EMAIL_MAX_LENGTH = 254;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export type SignUpInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  passwordConfirmation: string;
};

export type SignUpFieldErrors = Partial<Record<keyof SignUpInput, string>>;

export type SignUpValidation =
  | { ok: true; value: SignUpInput }
  | { ok: false; fieldErrors: SignUpFieldErrors };

/** Matches the `users.email_format` constraint in the database schema. */
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function readString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];

  return typeof value === "string" ? value : null;
}

/** Normalizes an email for storage and case-insensitive lookups. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validateFirstName(
  record: Record<string, unknown>,
  fieldErrors: SignUpFieldErrors,
): string | null {
  const raw = readString(record, "firstName");

  if (raw === null || raw.trim().length === 0) {
    fieldErrors.firstName = "Enter your first name.";

    return null;
  }

  const value = raw.trim();

  if (value.length > FIRST_NAME_MAX_LENGTH) {
    fieldErrors.firstName = `First name must be ${FIRST_NAME_MAX_LENGTH} characters or fewer.`;

    return null;
  }

  return value;
}

function validateLastName(
  record: Record<string, unknown>,
  fieldErrors: SignUpFieldErrors,
): string | null {
  const raw = readString(record, "lastName");

  if (raw === null || raw.trim().length === 0) {
    fieldErrors.lastName = "Enter your last name.";

    return null;
  }

  const value = raw.trim();

  if (value.length > LAST_NAME_MAX_LENGTH) {
    fieldErrors.lastName = `Last name must be ${LAST_NAME_MAX_LENGTH} characters or fewer.`;

    return null;
  }

  return value;
}

function validateEmail(
  record: Record<string, unknown>,
  fieldErrors: SignUpFieldErrors,
): string | null {
  const raw = readString(record, "email");

  if (raw === null || raw.trim().length === 0) {
    fieldErrors.email = "Enter your email address.";

    return null;
  }

  const value = normalizeEmail(raw);

  if (value.length > EMAIL_MAX_LENGTH) {
    fieldErrors.email = `Email must be ${EMAIL_MAX_LENGTH} characters or fewer.`;

    return null;
  }

  if (!EMAIL_PATTERN.test(value)) {
    fieldErrors.email = "Enter a valid email address.";

    return null;
  }

  return value;
}

function validatePassword(
  record: Record<string, unknown>,
  fieldErrors: SignUpFieldErrors,
): string | null {
  const value = readString(record, "password");

  if (value === null || value.length === 0) {
    fieldErrors.password = "Enter a password.";

    return null;
  }

  if (value.length < PASSWORD_MIN_LENGTH) {
    fieldErrors.password = `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;

    return null;
  }

  if (value.length > PASSWORD_MAX_LENGTH) {
    fieldErrors.password = `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`;

    return null;
  }

  return value;
}

function validatePasswordConfirmation(
  record: Record<string, unknown>,
  password: string | null,
  fieldErrors: SignUpFieldErrors,
): string | null {
  const value = readString(record, "passwordConfirmation");

  if (value === null || value.length === 0) {
    fieldErrors.passwordConfirmation = "Confirm your password.";

    return null;
  }

  if (password === null || value !== password) {
    fieldErrors.passwordConfirmation = "Passwords do not match.";

    return null;
  }

  return value;
}

/**
 * Validates the raw request body and returns the normalized input when every
 * field is valid. Names are trimmed, the email is lowercased and the password
 * is kept exactly as typed (spaces are valid characters).
 */
export function validateSignUpInput(input: unknown): SignUpValidation {
  const record =
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const fieldErrors: SignUpFieldErrors = {};

  const firstName = validateFirstName(record, fieldErrors);
  const lastName = validateLastName(record, fieldErrors);
  const email = validateEmail(record, fieldErrors);
  const password = validatePassword(record, fieldErrors);
  const passwordConfirmation = validatePasswordConfirmation(
    record,
    password,
    fieldErrors,
  );

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    value: {
      firstName: firstName ?? "",
      lastName: lastName ?? "",
      email: email ?? "",
      password: password ?? "",
      passwordConfirmation: passwordConfirmation ?? "",
    },
  };
}
