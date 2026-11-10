/** Public authentication routes. */
export const AUTH_SIGN_UP_PATH = "/auth/sign-up";
export const AUTH_SIGN_IN_PATH = "/auth/sign-in";
export const AUTH_CONFIRM_PATH = "/auth/confirm";
export const AUTH_FORGOT_PASSWORD_PATH = "/auth/forgot-password";
export const AUTH_RESET_PASSWORD_PATH = "/auth/reset-password";

/** Private application root. */
export const APP_HOME_PATH = "/app";

/**
 * Destination for an unauthenticated visit to `/app/*`. Slice 006 switches
 * this to `/auth/sign-in` once the public sign-in flow exists.
 */
export const SIGNED_OUT_REDIRECT_PATH = AUTH_SIGN_UP_PATH;

/**
 * Auth pages that add no value for someone who already has a session.
 * Forgot and reset password stay accessible so recovery works anywhere.
 */
const AUTH_PATHS_REDIRECTING_SIGNED_IN: readonly string[] = [
  AUTH_SIGN_UP_PATH,
  AUTH_SIGN_IN_PATH,
  AUTH_CONFIRM_PATH,
];

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.replace(/\/+$/, "");
  }

  return pathname;
}

/** Decides where `/` sends the visitor based on session presence. */
export function getRootRedirectPath(hasSession: boolean): string {
  return hasSession ? APP_HOME_PATH : SIGNED_OUT_REDIRECT_PATH;
}

/** Returns the redirect target for `/app/*`, or `null` when access is allowed. */
export function getPrivateAreaRedirectPath(hasSession: boolean): string | null {
  return hasSession ? null : SIGNED_OUT_REDIRECT_PATH;
}

/**
 * Tells whether a signed-in person visiting an auth page should be sent to
 * `/app`. Only sign-up, sign-in and confirm redirect; forgot and reset keep
 * working with an active session.
 */
export function shouldRedirectFromAuthPath(
  pathname: string,
  hasSession: boolean,
): boolean {
  if (!hasSession) {
    return false;
  }

  return AUTH_PATHS_REDIRECTING_SIGNED_IN.includes(normalizePath(pathname));
}
