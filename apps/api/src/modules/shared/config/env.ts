export type EnvSource = Record<string, string | undefined>;

/** Minimum length (characters) required for the JWT signing secret (HS256, 256 bits). */
export const JWT_SECRET_MIN_LENGTH = 32;

/** Effective environment used when `NODE_ENV` is absent or empty. */
export const DEFAULT_NODE_ENV = "dev";

/** Only this exact normalized value selects the production email provider. */
export const PRODUCTION_NODE_ENV = "production";

/** Transactional email providers supported by the API. */
export type EmailProvider = "mailtrap" | "resend";

/** Default session duration in seconds (7 days), configurable via SESSION_TTL_SECONDS. */
export const DEFAULT_SESSION_TTL_SECONDS = 604_800;

/** Default email confirmation token lifetime (24 hours). */
export const DEFAULT_CONFIRMATION_TOKEN_TTL_SECONDS = 86_400;

/** Default sign-up rate limit: requests allowed per IP inside the window. */
export const DEFAULT_SIGN_UP_RATE_LIMIT_MAX = 5;

/** Default sign-up rate limit window (60 seconds). */
export const DEFAULT_SIGN_UP_RATE_LIMIT_WINDOW_SECONDS = 60;

/** Default confirmation rate limit: requests allowed per IP inside the window. */
export const DEFAULT_CONFIRMATION_RATE_LIMIT_MAX = 10;

/** Default confirmation rate limit window (60 seconds). */
export const DEFAULT_CONFIRMATION_RATE_LIMIT_WINDOW_SECONDS = 60;

/** Default password reset token lifetime (1 hour), configurable via RESET_TOKEN_TTL_SECONDS. */
export const DEFAULT_RESET_TOKEN_TTL_SECONDS = 3_600;

/** Default forgot-password rate limit: requests allowed per key inside the window. */
export const DEFAULT_FORGOT_PASSWORD_RATE_LIMIT_MAX = 5;

/** Default forgot-password rate limit window (60 seconds). */
export const DEFAULT_FORGOT_PASSWORD_RATE_LIMIT_WINDOW_SECONDS = 60;

/** Default sign-in rate limit: attempts allowed per IP + email inside the window. */
export const DEFAULT_SIGN_IN_RATE_LIMIT_MAX = 5;

/** Default sign-in rate limit window (60 seconds). */
export const DEFAULT_SIGN_IN_RATE_LIMIT_WINDOW_SECONDS = 60;

/** Default reset-password rate limit: attempts allowed per IP inside the window. */
export const DEFAULT_RESET_PASSWORD_RATE_LIMIT_MAX = 5;

/** Default reset-password rate limit window (60 seconds). */
export const DEFAULT_RESET_PASSWORD_RATE_LIMIT_WINDOW_SECONDS = 60;

/** Default maximum length (characters) accepted for an Expert prompt. */
export const DEFAULT_EXPERT_PROMPT_MAX_LENGTH = 4_000;

/** Upper bound accepted for the configurable prompt length limit. */
export const MAX_EXPERT_PROMPT_MAX_LENGTH = 100_000;

export type Env = {
  /** Effective runtime environment (`NODE_ENV` normalized, defaulting to `dev`). */
  nodeEnv: string;
  /** Transactional email provider selected from `nodeEnv`. */
  emailProvider: EmailProvider;
  port: number;
  webOrigin: string;
  /** PostgreSQL connection string; the only database configuration the API needs. */
  databaseUrl: string;
  otlpEndpoint: string;
  serviceName: string;
  jwtSecret: string;
  sessionTtlSeconds: number;
  confirmationTokenTtlSeconds: number;
  signUpRateLimitMax: number;
  signUpRateLimitWindowSeconds: number;
  confirmationRateLimitMax: number;
  confirmationRateLimitWindowSeconds: number;
  resetTokenTtlSeconds: number;
  forgotPasswordRateLimitMax: number;
  forgotPasswordRateLimitWindowSeconds: number;
  signInRateLimitMax: number;
  signInRateLimitWindowSeconds: number;
  resetPasswordRateLimitMax: number;
  resetPasswordRateLimitWindowSeconds: number;
  /** Resend API key (secret); empty when Resend is not the active provider. */
  resendApiKey: string;
  /** Mailtrap Email API token (secret); empty when Mailtrap is not the active provider. */
  mailtrapApiToken: string;
  /** Sender address shared by both providers; the domain must be verified there. */
  mailFromEmail: string;
  mailFromName: string;
  /** When true, transactional email goes to the Mailtrap sandbox instead of the Sending API. */
  mailtrapSandbox: boolean;
  /** Mailtrap sandbox (inbox) ID; required when `mailtrapSandbox` is true. */
  mailtrapSandboxId: number | null;
  /** OpenAI API key (secret); empty when the model provider is not configured. */
  openaiApiKey: string;
  /** Maximum number of characters accepted in a single Expert prompt. */
  expertPromptMaxLength: number;
};

export class ConfigurationError extends Error {
  readonly missing: string[];
  readonly invalid: string[];

  constructor(missing: string[], invalid: string[]) {
    const details: string[] = [];

    if (missing.length > 0) {
      details.push(`Variáveis ausentes: ${missing.join(", ")}`);
    }

    if (invalid.length > 0) {
      details.push(`Variáveis inválidas: ${invalid.join(", ")}`);
    }

    super(`Configuração de ambiente inválida. ${details.join(". ")}.`);
    this.name = "ConfigurationError";
    this.missing = missing;
    this.invalid = invalid;
  }
}

function readString(value: string | undefined): string {
  return value?.trim() ?? "";
}

/**
 * Normalizes `NODE_ENV` so whitespace and capitalization cannot produce an
 * ambiguous provider selection. Absent/empty values fall back to `dev`.
 */
function readNodeEnv(value: string | undefined): string {
  const normalized = readString(value).toLowerCase();

  return normalized || DEFAULT_NODE_ENV;
}

/** `production` selects Resend; every other effective value selects Mailtrap. */
export function selectEmailProvider(nodeEnv: string): EmailProvider {
  return nodeEnv === PRODUCTION_NODE_ENV ? "resend" : "mailtrap";
}

/** Returns `null` when the value is not a recognized boolean flag. */
function readBooleanFlag(value: string): boolean | null {
  const normalized = value.trim().toLowerCase();

  if (
    normalized === "" ||
    normalized === "false" ||
    normalized === "0" ||
    normalized === "no"
  ) {
    return false;
  }

  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }

  return null;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** PostgreSQL URLs are accepted with either `postgres://` or `postgresql://`. */
function isValidPostgresUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.protocol === "postgres:" || url.protocol === "postgresql:";
  } catch {
    return false;
  }
}

export function loadEnv(source: EnvSource = process.env): Env {
  const missing: string[] = [];
  const invalid: string[] = [];

  const webOrigin = readString(source.WEB_ORIGIN);
  const databaseUrl = readString(source.DATABASE_URL);
  const otlpEndpoint = readString(source.OTEL_EXPORTER_OTLP_ENDPOINT);
  const serviceName =
    readString(source.OTEL_SERVICE_NAME) || "coders-modulo-4-api";
  const jwtSecret = readString(source.JWT_SECRET);

  if (!webOrigin) missing.push("WEB_ORIGIN");
  if (!databaseUrl) missing.push("DATABASE_URL");
  if (!otlpEndpoint) missing.push("OTEL_EXPORTER_OTLP_ENDPOINT");
  if (!jwtSecret) missing.push("JWT_SECRET");

  if (jwtSecret && jwtSecret.length < JWT_SECRET_MIN_LENGTH) {
    invalid.push("JWT_SECRET");
  }

  const portValue = readString(source.PORT) || "3333";
  const port = Number(portValue);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    invalid.push("PORT");
  }

  const sessionTtlValue =
    readString(source.SESSION_TTL_SECONDS) ||
    String(DEFAULT_SESSION_TTL_SECONDS);
  const sessionTtlSeconds = Number(sessionTtlValue);

  if (
    !Number.isInteger(sessionTtlSeconds) ||
    sessionTtlSeconds < 1 ||
    sessionTtlSeconds > 31_536_000
  ) {
    invalid.push("SESSION_TTL_SECONDS");
  }

  const confirmationTokenTtlValue =
    readString(source.CONFIRMATION_TOKEN_TTL_SECONDS) ||
    String(DEFAULT_CONFIRMATION_TOKEN_TTL_SECONDS);
  const confirmationTokenTtlSeconds = Number(confirmationTokenTtlValue);

  if (
    !Number.isInteger(confirmationTokenTtlSeconds) ||
    confirmationTokenTtlSeconds < 1 ||
    confirmationTokenTtlSeconds > 31_536_000
  ) {
    invalid.push("CONFIRMATION_TOKEN_TTL_SECONDS");
  }

  const signUpRateLimitMaxValue =
    readString(source.SIGN_UP_RATE_LIMIT_MAX) ||
    String(DEFAULT_SIGN_UP_RATE_LIMIT_MAX);
  const signUpRateLimitMax = Number(signUpRateLimitMaxValue);

  if (
    !Number.isInteger(signUpRateLimitMax) ||
    signUpRateLimitMax < 1 ||
    signUpRateLimitMax > 10_000
  ) {
    invalid.push("SIGN_UP_RATE_LIMIT_MAX");
  }

  const signUpRateLimitWindowValue =
    readString(source.SIGN_UP_RATE_LIMIT_WINDOW_SECONDS) ||
    String(DEFAULT_SIGN_UP_RATE_LIMIT_WINDOW_SECONDS);
  const signUpRateLimitWindowSeconds = Number(signUpRateLimitWindowValue);

  if (
    !Number.isInteger(signUpRateLimitWindowSeconds) ||
    signUpRateLimitWindowSeconds < 1 ||
    signUpRateLimitWindowSeconds > 86_400
  ) {
    invalid.push("SIGN_UP_RATE_LIMIT_WINDOW_SECONDS");
  }

  const confirmationRateLimitMaxValue =
    readString(source.CONFIRMATION_RATE_LIMIT_MAX) ||
    String(DEFAULT_CONFIRMATION_RATE_LIMIT_MAX);
  const confirmationRateLimitMax = Number(confirmationRateLimitMaxValue);

  if (
    !Number.isInteger(confirmationRateLimitMax) ||
    confirmationRateLimitMax < 1 ||
    confirmationRateLimitMax > 10_000
  ) {
    invalid.push("CONFIRMATION_RATE_LIMIT_MAX");
  }

  const confirmationRateLimitWindowValue =
    readString(source.CONFIRMATION_RATE_LIMIT_WINDOW_SECONDS) ||
    String(DEFAULT_CONFIRMATION_RATE_LIMIT_WINDOW_SECONDS);
  const confirmationRateLimitWindowSeconds = Number(
    confirmationRateLimitWindowValue,
  );

  if (
    !Number.isInteger(confirmationRateLimitWindowSeconds) ||
    confirmationRateLimitWindowSeconds < 1 ||
    confirmationRateLimitWindowSeconds > 86_400
  ) {
    invalid.push("CONFIRMATION_RATE_LIMIT_WINDOW_SECONDS");
  }

  const resetTokenTtlValue =
    readString(source.RESET_TOKEN_TTL_SECONDS) ||
    String(DEFAULT_RESET_TOKEN_TTL_SECONDS);
  const resetTokenTtlSeconds = Number(resetTokenTtlValue);

  if (
    !Number.isInteger(resetTokenTtlSeconds) ||
    resetTokenTtlSeconds < 1 ||
    resetTokenTtlSeconds > 31_536_000
  ) {
    invalid.push("RESET_TOKEN_TTL_SECONDS");
  }

  const forgotPasswordRateLimitMaxValue =
    readString(source.FORGOT_PASSWORD_RATE_LIMIT_MAX) ||
    String(DEFAULT_FORGOT_PASSWORD_RATE_LIMIT_MAX);
  const forgotPasswordRateLimitMax = Number(forgotPasswordRateLimitMaxValue);

  if (
    !Number.isInteger(forgotPasswordRateLimitMax) ||
    forgotPasswordRateLimitMax < 1 ||
    forgotPasswordRateLimitMax > 10_000
  ) {
    invalid.push("FORGOT_PASSWORD_RATE_LIMIT_MAX");
  }

  const forgotPasswordRateLimitWindowValue =
    readString(source.FORGOT_PASSWORD_RATE_LIMIT_WINDOW_SECONDS) ||
    String(DEFAULT_FORGOT_PASSWORD_RATE_LIMIT_WINDOW_SECONDS);
  const forgotPasswordRateLimitWindowSeconds = Number(
    forgotPasswordRateLimitWindowValue,
  );

  if (
    !Number.isInteger(forgotPasswordRateLimitWindowSeconds) ||
    forgotPasswordRateLimitWindowSeconds < 1 ||
    forgotPasswordRateLimitWindowSeconds > 86_400
  ) {
    invalid.push("FORGOT_PASSWORD_RATE_LIMIT_WINDOW_SECONDS");
  }

  const signInRateLimitMaxValue =
    readString(source.SIGN_IN_RATE_LIMIT_MAX) ||
    String(DEFAULT_SIGN_IN_RATE_LIMIT_MAX);
  const signInRateLimitMax = Number(signInRateLimitMaxValue);

  if (
    !Number.isInteger(signInRateLimitMax) ||
    signInRateLimitMax < 1 ||
    signInRateLimitMax > 10_000
  ) {
    invalid.push("SIGN_IN_RATE_LIMIT_MAX");
  }

  const signInRateLimitWindowValue =
    readString(source.SIGN_IN_RATE_LIMIT_WINDOW_SECONDS) ||
    String(DEFAULT_SIGN_IN_RATE_LIMIT_WINDOW_SECONDS);
  const signInRateLimitWindowSeconds = Number(signInRateLimitWindowValue);

  if (
    !Number.isInteger(signInRateLimitWindowSeconds) ||
    signInRateLimitWindowSeconds < 1 ||
    signInRateLimitWindowSeconds > 86_400
  ) {
    invalid.push("SIGN_IN_RATE_LIMIT_WINDOW_SECONDS");
  }

  const resetPasswordRateLimitMaxValue =
    readString(source.RESET_PASSWORD_RATE_LIMIT_MAX) ||
    String(DEFAULT_RESET_PASSWORD_RATE_LIMIT_MAX);
  const resetPasswordRateLimitMax = Number(resetPasswordRateLimitMaxValue);

  if (
    !Number.isInteger(resetPasswordRateLimitMax) ||
    resetPasswordRateLimitMax < 1 ||
    resetPasswordRateLimitMax > 10_000
  ) {
    invalid.push("RESET_PASSWORD_RATE_LIMIT_MAX");
  }

  const resetPasswordRateLimitWindowValue =
    readString(source.RESET_PASSWORD_RATE_LIMIT_WINDOW_SECONDS) ||
    String(DEFAULT_RESET_PASSWORD_RATE_LIMIT_WINDOW_SECONDS);
  const resetPasswordRateLimitWindowSeconds = Number(
    resetPasswordRateLimitWindowValue,
  );

  if (
    !Number.isInteger(resetPasswordRateLimitWindowSeconds) ||
    resetPasswordRateLimitWindowSeconds < 1 ||
    resetPasswordRateLimitWindowSeconds > 86_400
  ) {
    invalid.push("RESET_PASSWORD_RATE_LIMIT_WINDOW_SECONDS");
  }

  const nodeEnv = readNodeEnv(source.NODE_ENV);
  const emailProvider = selectEmailProvider(nodeEnv);
  const resendApiKey = readString(source.RESEND_API_KEY);
  const mailtrapApiToken = readString(source.MAILTRAP_API_TOKEN);
  const mailFromEmail =
    readString(source.MAIL_FROM_EMAIL) || "hello@demomailtrap.co";
  const mailFromName = readString(source.MAIL_FROM_NAME) || "Experts";
  const mailtrapSandbox = readBooleanFlag(readString(source.MAILTRAP_SANDBOX));
  const mailtrapSandboxIdValue = readString(source.MAILTRAP_SANDBOX_ID);
  const mailtrapSandboxId =
    mailtrapSandboxIdValue === "" ? null : Number(mailtrapSandboxIdValue);

  // Optional at boot: a missing key produces an actionable 503 only when a
  // prompt is actually sent, keeping local development and tests hermetic.
  const openaiApiKey = readString(source.OPENAI_API_KEY);
  const expertPromptMaxLengthValue =
    readString(source.EXPERT_PROMPT_MAX_LENGTH) ||
    String(DEFAULT_EXPERT_PROMPT_MAX_LENGTH);
  const expertPromptMaxLength = Number(expertPromptMaxLengthValue);

  if (
    !Number.isInteger(expertPromptMaxLength) ||
    expertPromptMaxLength < 1 ||
    expertPromptMaxLength > MAX_EXPERT_PROMPT_MAX_LENGTH
  ) {
    invalid.push("EXPERT_PROMPT_MAX_LENGTH");
  }

  if (emailProvider === "resend") {
    if (!resendApiKey) missing.push("RESEND_API_KEY");
  } else if (!mailtrapApiToken) {
    missing.push("MAILTRAP_API_TOKEN");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailFromEmail)) {
    invalid.push("MAIL_FROM_EMAIL");
  }

  // Variables from the inactive provider are intentionally ignored.
  if (emailProvider === "mailtrap") {
    if (mailtrapSandbox === null) invalid.push("MAILTRAP_SANDBOX");

    if (mailtrapSandbox === true) {
      if (mailtrapSandboxId === null) {
        missing.push("MAILTRAP_SANDBOX_ID");
      } else if (
        !Number.isInteger(mailtrapSandboxId) ||
        mailtrapSandboxId < 1
      ) {
        invalid.push("MAILTRAP_SANDBOX_ID");
      }
    }
  }

  if (webOrigin && !isValidHttpUrl(webOrigin)) invalid.push("WEB_ORIGIN");
  if (databaseUrl && !isValidPostgresUrl(databaseUrl)) {
    invalid.push("DATABASE_URL");
  }
  if (otlpEndpoint && !isValidHttpUrl(otlpEndpoint)) {
    invalid.push("OTEL_EXPORTER_OTLP_ENDPOINT");
  }

  if (missing.length > 0 || invalid.length > 0) {
    throw new ConfigurationError(missing, invalid);
  }

  return {
    nodeEnv,
    emailProvider,
    port,
    webOrigin: new URL(webOrigin).origin,
    databaseUrl,
    otlpEndpoint,
    serviceName,
    jwtSecret,
    sessionTtlSeconds,
    confirmationTokenTtlSeconds,
    signUpRateLimitMax,
    signUpRateLimitWindowSeconds,
    confirmationRateLimitMax,
    confirmationRateLimitWindowSeconds,
    resetTokenTtlSeconds,
    forgotPasswordRateLimitMax,
    forgotPasswordRateLimitWindowSeconds,
    signInRateLimitMax,
    signInRateLimitWindowSeconds,
    resetPasswordRateLimitMax,
    resetPasswordRateLimitWindowSeconds,
    resendApiKey: emailProvider === "resend" ? resendApiKey : "",
    mailtrapApiToken: emailProvider === "mailtrap" ? mailtrapApiToken : "",
    mailFromEmail,
    mailFromName,
    mailtrapSandbox: emailProvider === "mailtrap" && mailtrapSandbox === true,
    mailtrapSandboxId:
      emailProvider === "mailtrap" && mailtrapSandbox === true
        ? mailtrapSandboxId
        : null,
    openaiApiKey,
    expertPromptMaxLength,
  };
}
