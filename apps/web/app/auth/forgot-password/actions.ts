"use server";

import { fetchApiWithSession } from "../../../lib/auth/api-client";
import {
  FORGOT_PASSWORD_API_PATH,
  parseForgotPasswordResponse,
  readForgotPasswordValues,
  type ForgotPasswordState,
} from "../../../lib/auth/forgot-password";

/**
 * Sends the recovery request from the Next server. `API_BASE_URL` and the
 * session cookie stay server-side; the browser only receives the form state.
 */
export async function forgotPasswordAction(
  _previousState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const values = readForgotPasswordValues(formData);

  try {
    const response = await fetchApiWithSession(FORGOT_PASSWORD_API_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    let payload: unknown = null;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    return parseForgotPasswordResponse(response.status, payload, values);
  } catch {
    return {
      status: "error",
      message: "We could not reach the server. Try again.",
      fieldErrors: {},
      values,
    };
  }
}
