"use server";

import { fetchApiWithSession } from "../../../lib/auth/api-client";
import {
  CONFIRM_API_PATH,
  CONFIRM_INVALID_MESSAGE,
  CONFIRM_NETWORK_ERROR_MESSAGE,
  CONFIRM_TOKEN_FIELD,
  parseConfirmResponse,
  readConfirmToken,
  type ConfirmState,
} from "../../../lib/auth/confirm";
import { setSessionCookie } from "../../../lib/auth/session-cookie";

/**
 * Sends the token to the API from the Next server, writes the returned JWT to
 * the HttpOnly cookie and returns only the form state. The token and the JWT
 * never reach the browser bundle or client-side JavaScript.
 */
export async function confirmAction(
  _previousState: ConfirmState,
  formData: FormData,
): Promise<ConfirmState> {
  const token = readConfirmToken(formData);

  if (token.length === 0) {
    return {
      status: "error",
      message: CONFIRM_INVALID_MESSAGE,
      canRetry: false,
    };
  }

  try {
    const response = await fetchApiWithSession(CONFIRM_API_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [CONFIRM_TOKEN_FIELD]: token }),
    });

    let payload: unknown = null;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    const result = parseConfirmResponse(response.status, payload);

    if (result.status === "success") {
      await setSessionCookie(result.accessToken, result.expiresIn);

      return { status: "success" };
    }

    return result;
  } catch {
    return {
      status: "error",
      message: CONFIRM_NETWORK_ERROR_MESSAGE,
      canRetry: true,
    };
  }
}
