/** Contract of the public sign-in endpoint and the form state it produces. */
export const SIGN_IN_API_PATH = "/api/v1/auth/sign-in";

export const SIGN_IN_VALIDATION_MESSAGE =
  "Enter your email address and password.";

export const SIGN_IN_INVALID_CREDENTIALS_MESSAGE = "Invalid email or password.";

export const SIGN_IN_EMAIL_NOT_CONFIRMED_MESSAGE =
  "Please confirm your email before signing in.";

export const SIGN_IN_RATE_LIMITED_MESSAGE =
  "Too many attempts. Wait a moment and try again.";

export const SIGN_IN_NETWORK_ERROR_MESSAGE =
  "We could not reach the server. Try again.";

export const SIGN_IN_GENERIC_ERROR_MESSAGE = "Something went wrong. Try again.";

export const SIGN_IN_FIELD_NAMES = ["email", "password"] as const;

export type SignInFieldName = (typeof SIGN_IN_FIELD_NAMES)[number];

export type SignInFieldErrors = Partial<Record<SignInFieldName, string>>;

/** Only the email is echoed back; the password is never kept in state. */
export type SignInFormValues = { email: string };

export type SignInState = {
  status: "idle" | "error";
  message: string;
  fieldErrors: SignInFieldErrors;
  values: SignInFormValues;
};

/** Result of `POST /api/v1/auth/sign-in`, before the JWT goes to a cookie. */
export type SignInResult =
  | { status: "success"; accessToken: string; expiresIn: number }
  | { status: "error"; message: string };

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

function isUsableExpiresIn(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function createInitialSignInState(): SignInState {
  return {
    status: "idle",
    message: "",
    fieldErrors: {},
    values: { email: "" },
  };
}

export type SignInCredentials = { email: string; password: string };

/** Reads the submitted credentials. The password is not trimmed or altered. */
export function readSignInCredentials(formData: FormData): SignInCredentials {
  const email = formData.get("email");
  const password = formData.get("password");

  return {
    email: typeof email === "string" ? email.trim() : "",
    password: typeof password === "string" ? password : "",
  };
}

/** Client-side-free validation: only the presence of both fields. */
export function validateSignInCredentials(
  credentials: SignInCredentials,
): SignInFieldErrors {
  const errors: SignInFieldErrors = {};

  if (credentials.email.length === 0) {
    errors.email = "Enter your email address.";
  }

  if (credentials.password.length === 0) {
    errors.password = "Enter your password.";
  }

  return errors;
}

/**
 * Converts the API response into the sign-in result. Success needs a non-empty
 * JWT and a positive `expiresIn`. Failures use fixed en-US copy per status, so
 * the UI never depends on server text and the `401` stays generic.
 */
export function parseSignInResponse(
  status: number,
  payload: unknown,
): SignInResult {
  const body = isRecord(payload) ? payload : {};

  if (status === 200) {
    const accessToken = readString(body, "accessToken");
    const expiresIn = body.expiresIn;

    if (
      accessToken !== null &&
      accessToken.length > 0 &&
      isUsableExpiresIn(expiresIn)
    ) {
      return { status: "success", accessToken, expiresIn };
    }

    return { status: "error", message: SIGN_IN_GENERIC_ERROR_MESSAGE };
  }

  const messageByStatus: Record<number, string> = {
    400: SIGN_IN_VALIDATION_MESSAGE,
    401: SIGN_IN_INVALID_CREDENTIALS_MESSAGE,
    403: SIGN_IN_EMAIL_NOT_CONFIRMED_MESSAGE,
    429: SIGN_IN_RATE_LIMITED_MESSAGE,
  };

  return {
    status: "error",
    message: messageByStatus[status] ?? SIGN_IN_GENERIC_ERROR_MESSAGE,
  };
}
