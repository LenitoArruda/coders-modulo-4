/** Contract of the public reset-password endpoint and the form state it produces. */
export const RESET_PASSWORD_API_PATH = "/api/v1/auth/reset-password";

/** Query parameter the sign-in page reads to show the success message. */
export const RESET_SUCCESS_PARAM = "reset";
export const RESET_SUCCESS_VALUE = "success";

export const RESET_PASSWORD_SUCCESS_MESSAGE =
  "Your password has been updated. Sign in with your new password.";

export const RESET_PASSWORD_INVALID_TOKEN_MESSAGE =
  "This password reset link is invalid or has expired.";

export const RESET_PASSWORD_VALIDATION_MESSAGE =
  "Check the highlighted fields and try again.";

export const RESET_PASSWORD_RATE_LIMITED_MESSAGE =
  "Too many attempts. Wait a moment and try again.";

export const RESET_PASSWORD_NETWORK_ERROR_MESSAGE =
  "We could not reach the server. Try again.";

export const RESET_PASSWORD_GENERIC_ERROR_MESSAGE =
  "Something went wrong. Try again.";

/** Token field name shared by the hidden input, the form action and the API body. */
export const RESET_TOKEN_FIELD = "token";

export const RESET_PASSWORD_FIELD_NAMES = [
  "password",
  "passwordConfirmation",
] as const;

export type ResetPasswordFieldName =
  (typeof RESET_PASSWORD_FIELD_NAMES)[number];

export type ResetPasswordFieldErrors = Partial<
  Record<ResetPasswordFieldName, string>
>;

/**
 * State exposed to the form. Passwords are never kept in state: the browser
 * clears them after a failed submission and the person types them again.
 * `invalidToken` switches the page to the "request a new link" state.
 */
export type ResetPasswordState = {
  status: "idle" | "error" | "success";
  message: string;
  fieldErrors: ResetPasswordFieldErrors;
  invalidToken: boolean;
};

export type ResetPasswordValues = {
  token: string;
  password: string;
  passwordConfirmation: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];

  return typeof value === "string" ? value : null;
}

function readFieldErrors(value: unknown): ResetPasswordFieldErrors {
  if (!isRecord(value)) {
    return {};
  }

  const fieldErrors: ResetPasswordFieldErrors = {};

  for (const field of RESET_PASSWORD_FIELD_NAMES) {
    const message = readString(value, field);

    if (message !== null && message.length > 0) {
      fieldErrors[field] = message;
    }
  }

  return fieldErrors;
}

export function createInitialResetPasswordState(): ResetPasswordState {
  return {
    status: "idle",
    message: "",
    fieldErrors: {},
    invalidToken: false,
  };
}

/** State for a link that is missing, invalid, expired or already used. */
export function createInvalidTokenState(): ResetPasswordState {
  return {
    status: "error",
    message: RESET_PASSWORD_INVALID_TOKEN_MESSAGE,
    fieldErrors: {},
    invalidToken: true,
  };
}

/** Reads the submitted values. Passwords are not trimmed or altered. */
export function readResetPasswordValues(
  formData: FormData,
): ResetPasswordValues {
  const token = formData.get(RESET_TOKEN_FIELD);
  const password = formData.get("password");
  const passwordConfirmation = formData.get("passwordConfirmation");

  return {
    token: typeof token === "string" ? token.trim() : "",
    password: typeof password === "string" ? password : "",
    passwordConfirmation:
      typeof passwordConfirmation === "string" ? passwordConfirmation : "",
  };
}

/**
 * Converts the API response into a form state. `INVALID_RESET_TOKEN` switches
 * to the invalid-link state; `VALIDATION_ERROR` keeps only the known fields so
 * unexpected properties never reach the UI.
 */
export function parseResetPasswordResponse(
  status: number,
  payload: unknown,
): ResetPasswordState {
  const body = isRecord(payload) ? payload : {};

  if (status === 200) {
    return {
      status: "success",
      message: RESET_PASSWORD_SUCCESS_MESSAGE,
      fieldErrors: {},
      invalidToken: false,
    };
  }

  if (status === 400 && body.code === "INVALID_RESET_TOKEN") {
    return createInvalidTokenState();
  }

  if (status === 400) {
    return {
      status: "error",
      message: RESET_PASSWORD_VALIDATION_MESSAGE,
      fieldErrors: readFieldErrors(body.fieldErrors),
      invalidToken: false,
    };
  }

  return {
    status: "error",
    message:
      status === 429
        ? RESET_PASSWORD_RATE_LIMITED_MESSAGE
        : RESET_PASSWORD_GENERIC_ERROR_MESSAGE,
    fieldErrors: {},
    invalidToken: false,
  };
}
