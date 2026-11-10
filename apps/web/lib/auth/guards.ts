import { redirect } from "next/navigation";

import { APP_HOME_PATH, SIGNED_OUT_REDIRECT_PATH } from "./route-rules";
import { getSessionUser, type SessionUser } from "./session";

/**
 * Server-side guard for `/app/*`. The API remains the source of truth: the
 * layout only asks whether the current cookie resolves to an active session.
 * Without one, the person goes to the signed-out destination of this slice.
 */
export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();

  if (user === null) {
    redirect(SIGNED_OUT_REDIRECT_PATH);
  }

  return user;
}

/**
 * Keeps authenticated people away from auth screens that would be useless to
 * them. Forgot and reset password must not call this helper.
 */
export async function redirectSignedInUserToApp(): Promise<void> {
  const user = await getSessionUser();

  if (user !== null) {
    redirect(APP_HOME_PATH);
  }
}
