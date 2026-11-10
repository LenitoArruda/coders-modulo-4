"use server";

import { fetchApiWithSession } from "../../../lib/auth/api-client";
import {
  RESET_PASSWORD_API_PATH,
  RESET_PASSWORD_NETWORK_ERROR_MESSAGE,
  createInvalidTokenState,
  parseResetPasswordResponse,
  readResetPasswordValues,
  type ResetPasswordState,
} from "../../../lib/auth/reset-password";

/**
 * Sends the new password to the API from the Next server. The token and the
 * passwords travel only in the request body; the state returned to the browser
 * never contains them.
 */
export async function resetPasswordAction(
  _previousState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const values = readResetPasswordValues(formData);

  if (values.token.length === 0) {
    return createInvalidTokenState();
  }

  try {
    const response = await fetchApiWithSession(RESET_PASSWORD_API_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
      cache: "no-store",
    });

    let payload: unknown = null;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    return parseResetPasswordResponse(response.status, payload);
  } catch {
    return {
      status: "error",
      message: RESET_PASSWORD_NETWORK_ERROR_MESSAGE,
      fieldErrors: {},
      invalidToken: false,
    };
  }
}
