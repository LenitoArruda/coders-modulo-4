import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  APP_HOME_PATH,
  RETURN_TO_HEADER,
  buildSignInPath,
} from "./route-rules";
import { getSessionUser, type SessionUser } from "./session";

/**
 * Server-side guard for `/app/*`. The API remains the source of truth: the
 * layout only asks whether the current cookie resolves to an active session.
 * Without one, the person goes to `/auth/sign-in` with a validated `returnTo`
 * (the requested path comes from `proxy.ts`, which sets `x-return-to`).
 */
export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();

  if (user === null) {
    const requested = (await headers()).get(RETURN_TO_HEADER);

    redirect(buildSignInPath(requested));
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
