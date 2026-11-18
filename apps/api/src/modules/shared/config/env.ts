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

/** Defaults for the optional RAG/citations slice (spec 016). */
export const DEFAULT_RAG_TOP_K = 5;
export const DEFAULT_RAG_THRESHOLD = 0.35;
export const DEFAULT_RAG_MAX_CONTEXT_CHARS = 6_000;
export const DEFAULT_RAG_MAX_HISTORY_MESSAGES = 6;

/** Defaults for the optional multimedia deliverables slice (spec 017). */
export const DEFAULT_MEDIA_IMAGE_MODEL_ID = "gpt-image-2";
export const DEFAULT_MEDIA_VIDEO_MODEL_ID = "gemini-omni-1.2-flash";
export const DEFAULT_MEDIA_IMAGE_QUOTA_PER_HOUR = 10;
export const DEFAULT_MEDIA_VIDEO_QUOTA_PER_HOUR = 2;
export const DEFAULT_MEDIA_QUOTA_WINDOW_SECONDS = 3_600;
export const DEFAULT_MEDIA_MAX_FILE_BYTES = 20 * 1024 * 1024;
export const DEFAULT_OPENAI_API_BASE_URL = "https://api.openai.com";
export const DEFAULT_GEMINI_API_BASE_URL =
  "https://generativelanguage.googleapis.com";

/** Default local-only LangSmith endpoint (spec 018). */
export const DEFAULT_LANGSMITH_ENDPOINT = "http://127.0.0.1:1980";
export const DEFAULT_OBS_TRACE_BATCH_SIZE = 32;
export const DEFAULT_OBS_TRACE_FLUSH_INTERVAL_MS = 1_000;
export const MAX_OBS_TRACE_BATCH_SIZE = 512;
export const MAX_OBS_TRACE_FLUSH_INTERVAL_MS = 60_000;

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
  /** Enables retrieval and citations; disabled by default (spec 016 rollout). */
  ragCitationsEnabled: boolean;
  /** Maximum number of retrieved chunks injected into the model. */
  ragTopK: number;
  /** Minimum Weaviate certainty for a chunk to be considered relevant. */
  ragThreshold: number;
  /** Maximum characters of retrieved context per answer. */
  ragMaxContextChars: number;
  /** Recent messages included in the grounded prompt. */
  ragMaxHistoryMessages: number;
  /** Enables image/video deliverables; disabled by default (spec 017). */
  multimediaDeliverablesEnabled: boolean;
  mediaImageModelId: string;
  mediaVideoModelId: string;
  mediaImageQuotaPerHour: number;
  mediaVideoQuotaPerHour: number;
  mediaQuotaWindowSeconds: number;
  mediaMaxFileBytes: number;
  openaiApiBaseUrl: string;
  geminiApiBaseUrl: string;
  /** Gemini API key (secret); empty until configured. */
  geminiApiKey: string;
  /** Enables LangSmith trace emission; disabled by default (spec 018). */
  obsTracingEnabled: boolean;
  /** Local-only LangSmith endpoint; cloud endpoints are rejected when enabled. */
  obsEndpoint: string;
  /** Local LangSmith API key (secret); never logged or returned to clients. */
  obsApiKey: string;
  /** Server-side salt used to pseudonymize user ids (secret); never logged. */
  obsUserPseudonymSalt: string;
  /** Maximum number of queued spans flushed in one batch. */
  obsTraceBatchSize: number;
  /** Maximum interval, in milliseconds, between buffer flushes. */
  obsTraceFlushIntervalMs: number;
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

/**
 * Trace endpoints must stay inside the local/private network. Loopback,
 * single-label Docker DNS names, `*.localhost`, `*.local`, `*.internal` and
 * RFC 1918 addresses are accepted; any public host (notably LangSmith Cloud)
 * is rejected. Used only when tracing is enabled, so a disabled setup never
 * needs a LangSmith credential to boot.
 */
export function isLocalTraceEndpoint(value: string): boolean {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return false;
  }

  if (url.username !== "" || url.password !== "") {
    return false;
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return true;
  }

  if (!host.includes(".")) {
    return true;
  }

  const octets = host.split(".").map(Number);

  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part))) {
    return false;
  }

  const first = octets[0] ?? -1;
  const second = octets[1] ?? -1;

  if (first === 10) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;

  return false;
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

  const ragCitationsEnabled =
    readBooleanFlag(readString(source.RAG_CITATIONS_ENABLED)) ?? false;
  const ragTopKValue =
    readString(source.RAG_TOP_K) || String(DEFAULT_RAG_TOP_K);
  const ragTopK = Number(ragTopKValue);
  const ragThresholdValue =
    readString(source.RAG_THRESHOLD) || String(DEFAULT_RAG_THRESHOLD);
  const ragThreshold = Number(ragThresholdValue);
  const ragMaxContextCharsValue =
    readString(source.RAG_MAX_CONTEXT_CHARS) ||
    String(DEFAULT_RAG_MAX_CONTEXT_CHARS);
  const ragMaxContextChars = Number(ragMaxContextCharsValue);
  const ragMaxHistoryMessagesValue =
    readString(source.RAG_MAX_HISTORY_MESSAGES) ||
    String(DEFAULT_RAG_MAX_HISTORY_MESSAGES);
  const ragMaxHistoryMessages = Number(ragMaxHistoryMessagesValue);
  const tracingFlag = readBooleanFlag(
    readString(source.LANGSMITH_TRACING_ENABLED),
  );
  const obsTracingEnabled = tracingFlag ?? false;
  const obsEndpoint =
    readString(source.LANGSMITH_ENDPOINT) || DEFAULT_LANGSMITH_ENDPOINT;
  const obsApiKey = readString(source.LANGSMITH_API_KEY);
  const obsUserPseudonymSalt = readString(source.OBS_USER_PSEUDONYM_SALT);
  const obsTraceBatchSizeValue =
    readString(source.OBS_TRACE_BATCH_SIZE) ||
    String(DEFAULT_OBS_TRACE_BATCH_SIZE);
  const obsTraceBatchSize = Number(obsTraceBatchSizeValue);
  const obsTraceFlushIntervalMsValue =
    readString(source.OBS_TRACE_FLUSH_INTERVAL_MS) ||
    String(DEFAULT_OBS_TRACE_FLUSH_INTERVAL_MS);
  const obsTraceFlushIntervalMs = Number(obsTraceFlushIntervalMsValue);

  if (!Number.isInteger(ragTopK) || ragTopK < 1 || ragTopK > 20) {
    invalid.push("RAG_TOP_K");
  }
  if (!Number.isFinite(ragThreshold) || ragThreshold < 0 || ragThreshold > 1) {
    invalid.push("RAG_THRESHOLD");
  }
  if (
    !Number.isInteger(ragMaxContextChars) ||
    ragMaxContextChars < 1 ||
    ragMaxContextChars > 100_000
  ) {
    invalid.push("RAG_MAX_CONTEXT_CHARS");
  }
  if (
    !Number.isInteger(ragMaxHistoryMessages) ||
    ragMaxHistoryMessages < 0 ||
    ragMaxHistoryMessages > 50
  ) {
    invalid.push("RAG_MAX_HISTORY_MESSAGES");
  }
  if (tracingFlag === null) invalid.push("LANGSMITH_TRACING_ENABLED");
  if (
    !Number.isInteger(obsTraceBatchSize) ||
    obsTraceBatchSize < 1 ||
    obsTraceBatchSize > MAX_OBS_TRACE_BATCH_SIZE
  ) {
    invalid.push("OBS_TRACE_BATCH_SIZE");
  }
  if (
    !Number.isInteger(obsTraceFlushIntervalMs) ||
    obsTraceFlushIntervalMs < 1 ||
    obsTraceFlushIntervalMs > MAX_OBS_TRACE_FLUSH_INTERVAL_MS
  ) {
    invalid.push("OBS_TRACE_FLUSH_INTERVAL_MS");
  }
  if (obsTracingEnabled) {
    if (!isLocalTraceEndpoint(obsEndpoint)) {
      invalid.push("LANGSMITH_ENDPOINT");
    }
    if (!obsApiKey) missing.push("LANGSMITH_API_KEY");
    if (!obsUserPseudonymSalt) missing.push("OBS_USER_PSEUDONYM_SALT");
  }

  const multimediaDeliverablesEnabled =
    readBooleanFlag(readString(source.MULTIMEDIA_DELIVERABLES_ENABLED)) ??
    false;
  const mediaImageModelId =
    readString(source.MEDIA_IMAGE_MODEL_ID) || DEFAULT_MEDIA_IMAGE_MODEL_ID;
  const mediaVideoModelId =
    readString(source.MEDIA_VIDEO_MODEL_ID) || DEFAULT_MEDIA_VIDEO_MODEL_ID;
  const mediaImageQuotaPerHour = Number(
    readString(source.MEDIA_IMAGE_QUOTA_PER_HOUR) ||
      String(DEFAULT_MEDIA_IMAGE_QUOTA_PER_HOUR),
  );
  const mediaVideoQuotaPerHour = Number(
    readString(source.MEDIA_VIDEO_QUOTA_PER_HOUR) ||
      String(DEFAULT_MEDIA_VIDEO_QUOTA_PER_HOUR),
  );
  const mediaQuotaWindowSeconds = Number(
    readString(source.MEDIA_QUOTA_WINDOW_SECONDS) ||
      String(DEFAULT_MEDIA_QUOTA_WINDOW_SECONDS),
  );
  const mediaMaxFileBytes =
    Number(
      readString(source.MEDIA_MAX_FILE_BYTES) ||
        String(DEFAULT_MEDIA_MAX_FILE_BYTES),
    ) || DEFAULT_MEDIA_MAX_FILE_BYTES;
  const openaiApiBaseUrl =
    readString(source.OPENAI_API_BASE_URL) || DEFAULT_OPENAI_API_BASE_URL;
  const geminiApiBaseUrl =
    readString(source.GEMINI_API_BASE_URL) || DEFAULT_GEMINI_API_BASE_URL;
  const geminiApiKey = readString(source.GEMINI_API_KEY);

  if (
    !Number.isInteger(mediaImageQuotaPerHour) ||
    mediaImageQuotaPerHour < 1 ||
    mediaImageQuotaPerHour > 10_000
  ) {
    invalid.push("MEDIA_IMAGE_QUOTA_PER_HOUR");
  }
  if (
    !Number.isInteger(mediaVideoQuotaPerHour) ||
    mediaVideoQuotaPerHour < 1 ||
    mediaVideoQuotaPerHour > 10_000
  ) {
    invalid.push("MEDIA_VIDEO_QUOTA_PER_HOUR");
  }
  if (
    !Number.isInteger(mediaQuotaWindowSeconds) ||
    mediaQuotaWindowSeconds < 60 ||
    mediaQuotaWindowSeconds > 86_400
  ) {
    invalid.push("MEDIA_QUOTA_WINDOW_SECONDS");
  }
  if (
    !Number.isInteger(mediaMaxFileBytes) ||
    mediaMaxFileBytes < 1_024 ||
    mediaMaxFileBytes > 104_857_600
  ) {
    invalid.push("MEDIA_MAX_FILE_BYTES");
  }
  if (!isValidHttpUrl(openaiApiBaseUrl)) invalid.push("OPENAI_API_BASE_URL");
  if (!isValidHttpUrl(geminiApiBaseUrl)) invalid.push("GEMINI_API_BASE_URL");

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
    ragCitationsEnabled,
    ragTopK,
    ragThreshold,
    ragMaxContextChars,
    ragMaxHistoryMessages,
    multimediaDeliverablesEnabled,
    mediaImageModelId,
    mediaVideoModelId,
    mediaImageQuotaPerHour,
    mediaVideoQuotaPerHour,
    mediaQuotaWindowSeconds,
    mediaMaxFileBytes,
    openaiApiBaseUrl,
    geminiApiBaseUrl,
    geminiApiKey,
    obsTracingEnabled,
    obsEndpoint: obsEndpoint.replace(/\/+$/, ""),
    obsApiKey,
    obsUserPseudonymSalt,
    obsTraceBatchSize,
    obsTraceFlushIntervalMs,
  };
}
