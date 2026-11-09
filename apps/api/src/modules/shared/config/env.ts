export type EnvSource = Record<string, string | undefined>;

export type Env = {
  port: number;
  webOrigin: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  otlpEndpoint: string;
  serviceName: string;
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

  if (!webOrigin) missing.push("WEB_ORIGIN");
  if (!supabaseUrl) missing.push("SUPABASE_URL");
  if (!supabaseAnonKey) missing.push("SUPABASE_ANON_KEY");
  if (!supabaseServiceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!otlpEndpoint) missing.push("OTEL_EXPORTER_OTLP_ENDPOINT");

  const portValue = readString(source.PORT) || "3333";
  const port = Number(portValue);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    invalid.push("PORT");
  }

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
  };
}
