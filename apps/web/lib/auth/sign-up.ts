/** Contract of the public sign-up endpoint and the form state it produces. */
export const SIGN_UP_API_PATH = "/api/v1/auth/sign-up";

export const SIGN_UP_SUCCESS_MESSAGE =
  "Check your email to confirm your account.";

export const SIGN_UP_FIELD_NAMES = [
  "firstName",
  "lastName",
  "email",
  "password",
  "passwordConfirmation",
] as const;

export type SignUpFieldName = (typeof SIGN_UP_FIELD_NAMES)[number];

export type SignUpFormValues = Record<SignUpFieldName, string>;

export type SignUpFieldErrors = Partial<Record<SignUpFieldName, string>>;

export type SignUpState = {
  status: "idle" | "error" | "success";
  message: string;
  fieldErrors: SignUpFieldErrors;
  values: SignUpFormValues;
};

const EMPTY_VALUES: SignUpFormValues = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  passwordConfirmation: "",
};

const MESSAGE_BY_STATUS: Record<number, string> = {
  400: "Check the highlighted fields and try again.",
  409: "An account with this email already exists. Sign in instead.",
  429: "Too many attempts. Wait a moment and try again.",
  503: "We could not send the confirmation email. Try again in a moment.",
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

function readFieldErrors(value: unknown): SignUpFieldErrors {
  if (!isRecord(value)) {
    return {};
  }

  const fieldErrors: SignUpFieldErrors = {};

  for (const field of SIGN_UP_FIELD_NAMES) {
    const message = readString(value, field);

    if (message !== null && message.length > 0) {
      fieldErrors[field] = message;
    }
  }

  return fieldErrors;
}

export function createInitialSignUpState(): SignUpState {
  return {
    status: "idle",
    message: "",
    fieldErrors: {},
    values: { ...EMPTY_VALUES },
  };
}

/** Reads the five fields from a submitted form, preserving what was typed. */
export function readSignUpValues(formData: FormData): SignUpFormValues {
  const values = { ...EMPTY_VALUES };

  for (const field of SIGN_UP_FIELD_NAMES) {
    const value = formData.get(field);
    values[field] = typeof value === "string" ? value : "";
  }

  return values;
}

/**
 * Converts the API response into a form state. Only the known fields are
 * accepted, so unexpected properties never reach the UI. Passwords are dropped
 * from the success state because the form is replaced by the confirmation
 * notice.
 */
export function parseSignUpResponse(
  status: number,
  payload: unknown,
  values: SignUpFormValues,
): SignUpState {
  const body = isRecord(payload) ? payload : {};

  if (status === 201 || status === 200) {
    return {
      status: "success",
      message: readString(body, "message") ?? SIGN_UP_SUCCESS_MESSAGE,
      fieldErrors: {},
      values: { ...values, password: "", passwordConfirmation: "" },
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
