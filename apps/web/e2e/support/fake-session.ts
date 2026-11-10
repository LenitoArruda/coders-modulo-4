/**
 * Deterministic session values shared by the fake API and the E2E specs.
 * The fake API only accepts `E2E_VALID_SESSION_TOKEN`; every other value
 * behaves like an expired or revoked session.
 */
export const E2E_VALID_SESSION_TOKEN = "valid-session-token";
export const E2E_INVALID_SESSION_TOKEN = "expired-session-token";

/**
 * Deterministic confirmation tokens. A successful confirmation reuses the
 * valid session token so `/me` keeps answering after the cookie is written.
 */
export const E2E_CONFIRM_TOKEN = "valid-confirmation-token";
export const E2E_CONFIRM_USED_TOKEN = "used-confirmation-token";
export const E2E_CONFIRM_INVALID_TOKEN = "invalid-confirmation-token";
export const E2E_CONFIRM_RATE_LIMITED_TOKEN = "rate-limited-confirmation-token";

/**
 * Sign-in credentials accepted by the fake API: any `<local>@signin.example.com`
 * with this password. Each token is `signin-<local>-<n>`, and only the latest
 * one per account stays valid (single-session policy).
 */
export const E2E_SIGN_IN_DOMAIN = "signin.example.com";
export const E2E_SIGN_IN_PASSWORD = "correct-password";

/**
 * Reset-password tokens: `reset-token:<local>:<unique>` is valid exactly once
 * and, when used, changes the password of `<local>@signin.example.com` and
 * revokes its sessions. Any other value is invalid, except the rate-limited one.
 */
export const E2E_RESET_TOKEN_PREFIX = "reset-token:";
export const E2E_RESET_RATE_LIMITED_TOKEN = "rate-limited-reset-token";

export function e2eResetToken(local: string, unique: string): string {
  return `${E2E_RESET_TOKEN_PREFIX}${local}:${unique}`;
}
