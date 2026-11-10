/**
 * DI tokens shared by the auth module. Configuration values are injected as
 * values (not a global config service) so adapters and use cases stay easy to
 * instantiate in unit tests.
 */
export const JWT_SECRET = Symbol("JWT_SECRET");
export const SESSION_TTL_SECONDS = Symbol("SESSION_TTL_SECONDS");
export const CONFIRMATION_TOKEN_TTL_SECONDS = Symbol(
  "CONFIRMATION_TOKEN_TTL_SECONDS",
);
export const SIGN_UP_RATE_LIMIT_MAX = Symbol("SIGN_UP_RATE_LIMIT_MAX");
export const SIGN_UP_RATE_LIMIT_WINDOW_SECONDS = Symbol(
  "SIGN_UP_RATE_LIMIT_WINDOW_SECONDS",
);
export const CONFIRMATION_RATE_LIMIT_MAX = Symbol(
  "CONFIRMATION_RATE_LIMIT_MAX",
);
export const CONFIRMATION_RATE_LIMIT_WINDOW_SECONDS = Symbol(
  "CONFIRMATION_RATE_LIMIT_WINDOW_SECONDS",
);
export const RESET_TOKEN_TTL_SECONDS = Symbol("RESET_TOKEN_TTL_SECONDS");
export const FORGOT_PASSWORD_RATE_LIMIT_MAX = Symbol(
  "FORGOT_PASSWORD_RATE_LIMIT_MAX",
);
export const FORGOT_PASSWORD_RATE_LIMIT_WINDOW_SECONDS = Symbol(
  "FORGOT_PASSWORD_RATE_LIMIT_WINDOW_SECONDS",
);
export const SIGN_IN_RATE_LIMIT_MAX = Symbol("SIGN_IN_RATE_LIMIT_MAX");
export const SIGN_IN_RATE_LIMIT_WINDOW_SECONDS = Symbol(
  "SIGN_IN_RATE_LIMIT_WINDOW_SECONDS",
);
export const RESET_PASSWORD_RATE_LIMIT_MAX = Symbol(
  "RESET_PASSWORD_RATE_LIMIT_MAX",
);
export const RESET_PASSWORD_RATE_LIMIT_WINDOW_SECONDS = Symbol(
  "RESET_PASSWORD_RATE_LIMIT_WINDOW_SECONDS",
);
export const WEB_ORIGIN = Symbol("WEB_ORIGIN");
export const SUPABASE_CLIENT = Symbol("SUPABASE_CLIENT");
export const SMTP_TRANSPORT = Symbol("SMTP_TRANSPORT");
export const SMTP_FROM = Symbol("SMTP_FROM");
