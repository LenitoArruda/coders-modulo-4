/** Contract of the public forgot-password endpoint and the form state it produces. */
export const FORGOT_PASSWORD_API_PATH = "/api/v1/auth/forgot-password";

export const FORGOT_PASSWORD_SUCCESS_MESSAGE =
  "If an account exists for this email, we sent a password reset link.";

export const FORGOT_PASSWORD_FIELD_NAMES = ["email"] as const;

export type ForgotPasswordFieldName =
  (typeof FORGOT_PASSWORD_FIELD_NAMES)[number];

export type ForgotPasswordFormValues = Record<ForgotPasswordFieldName, string>;

export type ForgotPasswordFieldErrors = Partial<
  Record<ForgotPasswordFieldName, string>
>;

export type ForgotPasswordState = {
  status: "idle" | "error" | "success";
  message: string;
  fieldErrors: ForgotPasswordFieldErrors;
  values: ForgotPasswordFormValues;
};

const EMPTY_VALUES: ForgotPasswordFormValues = { email: "" };

const MESSAGE_BY_STATUS: Record<number, string> = {
  400: "Check the highlighted fields and try again.",
  429: "Too many attempts. Wait a moment and try again.",
};

const GENERIC_ERROR_MESSAGE = "Something went wrong. Try again.";

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

function readFieldErrors(value: unknown): ForgotPasswordFieldErrors {
  if (!isRecord(value)) {
    return {};
  }

  const fieldErrors: ForgotPasswordFieldErrors = {};

  for (const field of FORGOT_PASSWORD_FIELD_NAMES) {
    const message = readString(value, field);

    if (message !== null && message.length > 0) {
      fieldErrors[field] = message;
    }
  }

  return fieldErrors;
}

export function createInitialForgotPasswordState(): ForgotPasswordState {
  return {
    status: "idle",
    message: "",
    fieldErrors: {},
    values: { ...EMPTY_VALUES },
  };
}

/** Reads the email from a submitted form, preserving what was typed. */
export function readForgotPasswordValues(
  formData: FormData,
): ForgotPasswordFormValues {
  const value = formData.get("email");

  return { email: typeof value === "string" ? value : "" };
}

/**
 * Converts the API response into a form state. Only the known field is
 * accepted, so unexpected properties never reach the UI. The success message
 * is always the same generic text, whether or not the account exists.
 */
export function parseForgotPasswordResponse(
  status: number,
  payload: unknown,
  values: ForgotPasswordFormValues,
): ForgotPasswordState {
  const body = isRecord(payload) ? payload : {};

  if (status === 200) {
    return {
      status: "success",
      message: readString(body, "message") ?? FORGOT_PASSWORD_SUCCESS_MESSAGE,
      fieldErrors: {},
      values,
    };
  }

  return {
    status: "error",
    message:
      readString(body, "message") ??
      MESSAGE_BY_STATUS[status] ??
      GENERIC_ERROR_MESSAGE,
    fieldErrors: readFieldErrors(body.fieldErrors),
    values,
  };
}
