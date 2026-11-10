"use server";

import { redirect } from "next/navigation";

import { fetchApiWithSession } from "../../../lib/auth/api-client";
import {
  sanitizeReturnTo,
  RETURN_TO_PARAM,
} from "../../../lib/auth/route-rules";
import { setSessionCookie } from "../../../lib/auth/session-cookie";
import {
  SIGN_IN_API_PATH,
  SIGN_IN_NETWORK_ERROR_MESSAGE,
  parseSignInResponse,
  readSignInCredentials,
  validateSignInCredentials,
  type SignInState,
} from "../../../lib/auth/sign-in";

/**
 * Sends the credentials to the API from the Next server, writes the returned
 * JWT to the HttpOnly cookie and redirects to the validated `returnTo`. The
 * password and the JWT never reach the browser bundle or client-side state;
 * only the typed email is echoed back on failure.
 */
export async function signInAction(
  _previousState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const credentials = readSignInCredentials(formData);
  const values = { email: credentials.email };
  const fieldErrors = validateSignInCredentials(credentials);

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Check the highlighted fields and try again.",
      fieldErrors,
      values,
    };
  }

  const destination = sanitizeReturnTo(formData.get(RETURN_TO_PARAM));
  let failureMessage: string;

  try {
    const response = await fetchApiWithSession(SIGN_IN_API_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
      cache: "no-store",
    });

    let payload: unknown = null;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    const result = parseSignInResponse(response.status, payload);

    if (result.status === "success") {
      await setSessionCookie(result.accessToken, result.expiresIn);
      failureMessage = "";
    } else {
      failureMessage = result.message;
    }
  } catch {
    failureMessage = SIGN_IN_NETWORK_ERROR_MESSAGE;
  }

  if (failureMessage.length > 0) {
    return {
      status: "error",
      message: failureMessage,
      fieldErrors: {},
      values,
    };
  }

  // `redirect` throws, so it must stay outside the try/catch above.
  redirect(destination);
}
