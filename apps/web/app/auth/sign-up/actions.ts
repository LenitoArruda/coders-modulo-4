"use server";

import { fetchApiWithSession } from "../../../lib/auth/api-client";
import {
  parseSignUpResponse,
  readSignUpValues,
  SIGN_UP_API_PATH,
  type SignUpState,
} from "../../../lib/auth/sign-up";

/**
 * Sends the form to the API from the Next server. `API_BASE_URL` and the
 * session cookie stay server-side; the browser only receives the form state.
 */
export async function signUpAction(
  _previousState: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  const values = readSignUpValues(formData);

  try {
    const response = await fetchApiWithSession(SIGN_UP_API_PATH, {
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

    return parseSignUpResponse(response.status, payload, values);
  } catch {
    return {
      status: "error",
      message: "We could not reach the server. Try again.",
      fieldErrors: {},
      values,
    };
  }
}
