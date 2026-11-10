/** Contract of the public confirmation endpoint and the state it produces. */
export const CONFIRM_API_PATH = "/api/v1/auth/confirm";

export const CONFIRM_INVALID_MESSAGE =
  "This confirmation link is invalid or has expired.";

export const CONFIRM_ALREADY_CONFIRMED_MESSAGE =
  "This account is already confirmed. Sign in instead.";

export const CONFIRM_RATE_LIMITED_MESSAGE =
  "Too many attempts. Wait a moment and try again.";

export const CONFIRM_NETWORK_ERROR_MESSAGE =
  "We could not reach the server. Try again.";

export const CONFIRM_GENERIC_ERROR_MESSAGE = "Something went wrong. Try again.";

/** Token field name shared by the hidden input, the form action and the API body. */
export const CONFIRM_TOKEN_FIELD = "token";

/** Result of `POST /api/v1/auth/confirm`, before the JWT is written to a cookie. */
export type ConfirmSuccess = {
  status: "success";
  accessToken: string;
  expiresIn: number;
};

/** Actionable failure rendered by the confirmation form. */
export type ConfirmFailure = {
  status: "error";
  message: string;
  canRetry: boolean;
};

export type ConfirmResult = ConfirmSuccess | ConfirmFailure;

/**
 * State exposed to the client component. The success variant never carries the
 * JWT: the Server Action writes it to the HttpOnly cookie and only reports
 * that the confirmation worked.
 */
export type ConfirmState =
  { status: "idle" } | { status: "success" } | ConfirmFailure;

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

export function createInitialConfirmState(): ConfirmState {
  return { status: "idle" };
}

/** Reads and normalizes the token submitted by the hidden input. */
export function readConfirmToken(formData: FormData): string {
  const value = formData.get(CONFIRM_TOKEN_FIELD);

  return typeof value === "string" ? value.trim() : "";
}

/**
 * Converts the API response into the confirmation result. Success requires a
 * non-empty JWT and a positive `expiresIn`, so a malformed success cannot
 * produce a broken cookie. Known failures keep the API message when present
 * and fall back to the en-US copy of this slice.
 */
export function parseConfirmResponse(
  status: number,
  payload: unknown,
): ConfirmResult {
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

    return {
      status: "error",
      message: CONFIRM_GENERIC_ERROR_MESSAGE,
      canRetry: true,
    };
  }

  const fallbackByStatus: Record<number, string> = {
    400: CONFIRM_INVALID_MESSAGE,
    409: CONFIRM_ALREADY_CONFIRMED_MESSAGE,
    429: CONFIRM_RATE_LIMITED_MESSAGE,
  };

  return {
    status: "error",
    message:
      readString(body, "message") ??
      fallbackByStatus[status] ??
      CONFIRM_GENERIC_ERROR_MESSAGE,
    canRetry: status === 429 || status >= 500,
  };
}
