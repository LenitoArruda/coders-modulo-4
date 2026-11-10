/** Public authentication routes. */
export const AUTH_SIGN_UP_PATH = "/auth/sign-up";
export const AUTH_SIGN_IN_PATH = "/auth/sign-in";
export const AUTH_CONFIRM_PATH = "/auth/confirm";
export const AUTH_FORGOT_PASSWORD_PATH = "/auth/forgot-password";
export const AUTH_RESET_PASSWORD_PATH = "/auth/reset-password";

/** Private application root. */
export const APP_HOME_PATH = "/app";

/** Destination for an unauthenticated visit to `/app/*` and for `/` without a session. */
export const SIGNED_OUT_REDIRECT_PATH = AUTH_SIGN_IN_PATH;

/** Query parameter that carries the private path to open after signing in. */
export const RETURN_TO_PARAM = "returnTo";

/**
 * Request header set by `proxy.ts` with the path (and query) being requested
 * under `/app/*`, so server layouts can build the `returnTo` redirect. Any
 * value is sanitized before use; it never grants access to anything.
 */
export const RETURN_TO_HEADER = "x-return-to";

const RETURN_TO_BASE = "http://returnto.invalid";
const CONTROL_OR_BACKSLASH = /[\\\u0000-\u001f\u007f]/;

function hasUnsafeSequence(value: string): boolean {
  if (CONTROL_OR_BACKSLASH.test(value) || value.includes("//")) {
    return true;
  }

  let decoded = value;

  // Decode up to a few layers so `%2f%2f`, `%5c` or `%2e%2e` cannot sneak in.
  for (let layer = 0; layer < 3; layer += 1) {
    try {
      const next = decodeURIComponent(decoded);

      if (next === decoded) {
        break;
      }

      decoded = next;
    } catch {
      return true;
    }

    if (
      CONTROL_OR_BACKSLASH.test(decoded) ||
      decoded.includes("//") ||
      decoded.split("/").includes("..")
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Validates a `returnTo` candidate and returns a safe internal path, or
 * `/app` when it is absent or unsafe. Only `/app` and `/app/...` are accepted
 * (path plus optional query; the fragment is dropped). Anything with a scheme,
 * protocol-relative form, backslash, control character or dot segment, or that
 * leaves the origin after parsing, falls back to `/app`.
 */
export function sanitizeReturnTo(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) {
    return APP_HOME_PATH;
  }

  if (value !== APP_HOME_PATH && !value.startsWith(`${APP_HOME_PATH}/`)) {
    if (!value.startsWith(`${APP_HOME_PATH}?`)) {
      return APP_HOME_PATH;
    }
  }

  if (hasUnsafeSequence(value)) {
    return APP_HOME_PATH;
  }

  let url: URL;

  try {
    url = new URL(value, RETURN_TO_BASE);
  } catch {
    return APP_HOME_PATH;
  }

  if (
    url.origin !== RETURN_TO_BASE ||
    (url.pathname !== APP_HOME_PATH &&
      !url.pathname.startsWith(`${APP_HOME_PATH}/`))
  ) {
    return APP_HOME_PATH;
  }

  return `${url.pathname}${url.search}`;
}

/** `/auth/sign-in`, with a validated `returnTo` when it points past `/app`. */
export function buildSignInPath(returnTo?: unknown): string {
  const safe = sanitizeReturnTo(returnTo);

  if (safe === APP_HOME_PATH) {
    return AUTH_SIGN_IN_PATH;
  }

  const params = new URLSearchParams({ [RETURN_TO_PARAM]: safe });

  return `${AUTH_SIGN_IN_PATH}?${params.toString()}`;
}

/**
 * Auth pages that add no value for someone who already has a session.
 * Forgot and reset password stay accessible so recovery works anywhere, and
 * confirm is handled by its own page because it must still process a token.
 */
const AUTH_PATHS_REDIRECTING_SIGNED_IN: readonly string[] = [
  AUTH_SIGN_UP_PATH,
  AUTH_SIGN_IN_PATH,
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
export function getPrivateAreaRedirectPath(
  hasSession: boolean,
  returnTo?: unknown,
): string | null {
  return hasSession ? null : buildSignInPath(returnTo);
}

/**
 * Tells whether a signed-in person visiting an auth page should be sent to
 * `/app`. Only sign-up and sign-in redirect; confirm decides based on the
 * presence of a token, and forgot/reset keep working with an active session.
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
