export type EnvSource = Record<string, string | undefined>;

/** Minimum length (characters) required for the JWT signing secret (HS256, 256 bits). */
export const JWT_SECRET_MIN_LENGTH = 32;

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

export type Env = {
  port: number;
  webOrigin: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  otlpEndpoint: string;
  serviceName: string;
  jwtSecret: string;
  sessionTtlSeconds: number;
  confirmationTokenTtlSeconds: number;
  signUpRateLimitMax: number;
  signUpRateLimitWindowSeconds: number;
  confirmationRateLimitMax: number;
  confirmationRateLimitWindowSeconds: number;
  smtpHost: string;
  smtpPort: number;
  smtpFrom: string;
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

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function loadEnv(source: EnvSource = process.env): Env {
  const missing: string[] = [];
  const invalid: string[] = [];

  const webOrigin = readString(source.WEB_ORIGIN);
  const supabaseUrl = readString(source.SUPABASE_URL);
  const supabaseAnonKey = readString(source.SUPABASE_ANON_KEY);
  const supabaseServiceRoleKey = readString(source.SUPABASE_SERVICE_ROLE_KEY);
  const otlpEndpoint = readString(source.OTEL_EXPORTER_OTLP_ENDPOINT);
  const serviceName =
    readString(source.OTEL_SERVICE_NAME) || "coders-modulo-4-api";
  const jwtSecret = readString(source.JWT_SECRET);

  if (!webOrigin) missing.push("WEB_ORIGIN");
  if (!supabaseUrl) missing.push("SUPABASE_URL");
  if (!supabaseAnonKey) missing.push("SUPABASE_ANON_KEY");
  if (!supabaseServiceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
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

  const smtpHost = readString(source.SMTP_HOST) || "127.0.0.1";
  const smtpPortValue = readString(source.SMTP_PORT) || "54325";
  const smtpPort = Number(smtpPortValue);

  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65_535) {
    invalid.push("SMTP_PORT");
  }

  const smtpFrom = readString(source.SMTP_FROM) || "no-reply@localhost";

  if (webOrigin && !isValidHttpUrl(webOrigin)) invalid.push("WEB_ORIGIN");
  if (supabaseUrl && !isValidHttpUrl(supabaseUrl)) invalid.push("SUPABASE_URL");
  if (otlpEndpoint && !isValidHttpUrl(otlpEndpoint)) {
    invalid.push("OTEL_EXPORTER_OTLP_ENDPOINT");
  }

  if (missing.length > 0 || invalid.length > 0) {
    throw new ConfigurationError(missing, invalid);
  }

  return {
    port,
    webOrigin: new URL(webOrigin).origin,
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    otlpEndpoint,
    serviceName,
    jwtSecret,
    sessionTtlSeconds,
    confirmationTokenTtlSeconds,
    signUpRateLimitMax,
    signUpRateLimitWindowSeconds,
    confirmationRateLimitMax,
    confirmationRateLimitWindowSeconds,
    smtpHost,
    smtpPort,
    smtpFrom,
  };
}
