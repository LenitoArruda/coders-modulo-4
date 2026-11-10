"use server";

import { redirect } from "next/navigation";

import { fetchApiWithSession } from "../../lib/auth/api-client";
import { SIGN_OUT_API_PATH } from "../../lib/auth/sign-out";
import { SIGNED_OUT_REDIRECT_PATH } from "../../lib/auth/route-rules";
import { clearSessionCookie } from "../../lib/auth/session-cookie";

/**
 * Revokes the session on the API (best effort) and always clears the HttpOnly
 * cookie, so the person is signed out locally even if the API is unreachable.
 */
export async function signOutAction(): Promise<void> {
  try {
    await fetchApiWithSession(SIGN_OUT_API_PATH, {
      method: "POST",
      cache: "no-store",
    });
  } catch {
    // The cookie is cleared below regardless.
  }

  await clearSessionCookie();

  // `redirect` throws, so it must stay outside the try/catch above.
  redirect(SIGNED_OUT_REDIRECT_PATH);
}
