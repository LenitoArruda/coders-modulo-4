/**
 * Deterministic session values shared by the fake API and the E2E specs.
 * The fake API only accepts `E2E_VALID_SESSION_TOKEN`; every other value
 * behaves like an expired or revoked session.
 */
export const E2E_VALID_SESSION_TOKEN = "valid-session-token";
export const E2E_INVALID_SESSION_TOKEN = "expired-session-token";
