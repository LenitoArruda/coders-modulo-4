import { cookies } from "next/headers";

/** Name of the HttpOnly cookie that stores the session JWT. */
export const SESSION_COOKIE_NAME = "session_token";

/** Default session duration (7 days), matching the API default. */
export const DEFAULT_SESSION_TTL_SECONDS = 604_800;

export type SessionCookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  path: "/";
  maxAge: number;
  secure: boolean;
};

/**
 * Cookie options for the session JWT: never readable by JavaScript, sent on
 * same-site navigations, scoped to the whole site, expiring with the session,
 * and `Secure` in production. The flag is injectable so tests do not mutate
 * the environment.
 */
export function createSessionCookieOptions(
  ttlSeconds: number = DEFAULT_SESSION_TTL_SECONDS,
  isProduction: boolean = process.env.NODE_ENV === "production",
): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ttlSeconds,
    secure: isProduction,
  };
}

/**
 * Writes the session cookie from a server context (route handler, server
 * action or middleware). Used by the confirmation (005) and sign-in (006)
 * slices once they have a JWT from the API.
 */
export async function setSessionCookie(
  token: string,
  ttlSeconds: number = DEFAULT_SESSION_TTL_SECONDS,
): Promise<void> {
  const store = await cookies();

  store.set(SESSION_COOKIE_NAME, token, createSessionCookieOptions(ttlSeconds));
}

/** Removes the session cookie (sign-out). */
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();

  store.delete(SESSION_COOKIE_NAME);
}
