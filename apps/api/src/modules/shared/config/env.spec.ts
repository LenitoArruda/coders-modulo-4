import { describe, expect, it } from "vitest";

import { ConfigurationError, loadEnv, type EnvSource } from "./env";

const validEnv: EnvSource = {
  PORT: "3333",
  WEB_ORIGIN: "http://localhost:3000",
  SUPABASE_URL: "http://localhost:54321",
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4317",
  JWT_SECRET: "test-jwt-secret-with-at-least-32-characters",
};

describe("loadEnv", () => {
  it("deve carregar uma configuração válida", () => {
    expect(loadEnv(validEnv)).toMatchObject({
      port: 3333,
      webOrigin: "http://localhost:3000",
      serviceName: "coders-modulo-4-api",
      jwtSecret: "test-jwt-secret-with-at-least-32-characters",
      sessionTtlSeconds: 604_800,
      confirmationTokenTtlSeconds: 86_400,
      signUpRateLimitMax: 5,
      signUpRateLimitWindowSeconds: 60,
      confirmationRateLimitMax: 10,
      confirmationRateLimitWindowSeconds: 60,
      smtpHost: "127.0.0.1",
      smtpPort: 54_325,
      smtpFrom: "no-reply@localhost",
    });
  });

  it("deve falhar quando o segredo do JWT está ausente", () => {
    const source = { ...validEnv, JWT_SECRET: undefined };

    expect(() => loadEnv(source)).toThrow(ConfigurationError);

    try {
      loadEnv(source);
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      expect((error as ConfigurationError).missing).toContain("JWT_SECRET");
    }
  });

  it("deve falhar quando o segredo do JWT é curto demais", () => {
    expect(() => loadEnv({ ...validEnv, JWT_SECRET: "short-secret" })).toThrow(
      /JWT_SECRET/,
    );
  });

  it("deve aplicar o TTL de sessão configurado", () => {
    expect(
      loadEnv({ ...validEnv, SESSION_TTL_SECONDS: "3600" }).sessionTtlSeconds,
    ).toBe(3600);
  });

  it("deve falhar quando o TTL de sessão é inválido", () => {
    expect(() => loadEnv({ ...validEnv, SESSION_TTL_SECONDS: "abc" })).toThrow(
      /SESSION_TTL_SECONDS/,
    );

    expect(() => loadEnv({ ...validEnv, SESSION_TTL_SECONDS: "0" })).toThrow(
      /SESSION_TTL_SECONDS/,
    );
  });

  it("deve aplicar a configuração de sign-up quando informada", () => {
    expect(
      loadEnv({
        ...validEnv,
        CONFIRMATION_TOKEN_TTL_SECONDS: "7200",
        SIGN_UP_RATE_LIMIT_MAX: "10",
        SIGN_UP_RATE_LIMIT_WINDOW_SECONDS: "120",
      }),
    ).toMatchObject({
      confirmationTokenTtlSeconds: 7_200,
      signUpRateLimitMax: 10,
      signUpRateLimitWindowSeconds: 120,
    });
  });

  it("deve falhar quando a configuração de sign-up é inválida", () => {
    expect(() =>
      loadEnv({ ...validEnv, CONFIRMATION_TOKEN_TTL_SECONDS: "abc" }),
    ).toThrow(/CONFIRMATION_TOKEN_TTL_SECONDS/);

    expect(() => loadEnv({ ...validEnv, SIGN_UP_RATE_LIMIT_MAX: "0" })).toThrow(
      /SIGN_UP_RATE_LIMIT_MAX/,
    );

    expect(() =>
      loadEnv({ ...validEnv, SIGN_UP_RATE_LIMIT_WINDOW_SECONDS: "0" }),
    ).toThrow(/SIGN_UP_RATE_LIMIT_WINDOW_SECONDS/);
  });

  it("deve aplicar a configuração de confirmação quando informada", () => {
    expect(
      loadEnv({
        ...validEnv,
        CONFIRMATION_RATE_LIMIT_MAX: "20",
        CONFIRMATION_RATE_LIMIT_WINDOW_SECONDS: "30",
      }),
    ).toMatchObject({
      confirmationRateLimitMax: 20,
      confirmationRateLimitWindowSeconds: 30,
    });
  });

  it("deve falhar quando a configuração de confirmação é inválida", () => {
    expect(() =>
      loadEnv({ ...validEnv, CONFIRMATION_RATE_LIMIT_MAX: "abc" }),
    ).toThrow(/CONFIRMATION_RATE_LIMIT_MAX/);

    expect(() =>
      loadEnv({ ...validEnv, CONFIRMATION_RATE_LIMIT_MAX: "0" }),
    ).toThrow(/CONFIRMATION_RATE_LIMIT_MAX/);

    expect(() =>
      loadEnv({ ...validEnv, CONFIRMATION_RATE_LIMIT_WINDOW_SECONDS: "0" }),
    ).toThrow(/CONFIRMATION_RATE_LIMIT_WINDOW_SECONDS/);
  });

  it("deve falhar quando a porta do SMTP é inválida", () => {
    expect(() => loadEnv({ ...validEnv, SMTP_PORT: "not-a-port" })).toThrow(
      /SMTP_PORT/,
    );
  });

  it("deve aplicar os overrides de SMTP quando informados", () => {
    expect(
      loadEnv({
        ...validEnv,
        SMTP_HOST: "smtp.example.com",
        SMTP_PORT: "587",
        SMTP_FROM: "no-reply@example.com",
      }),
    ).toMatchObject({
      smtpHost: "smtp.example.com",
      smtpPort: 587,
      smtpFrom: "no-reply@example.com",
    });
  });

  it("deve falhar quando uma variável obrigatória está ausente", () => {
    const source = { ...validEnv, WEB_ORIGIN: undefined };

    expect(() => loadEnv(source)).toThrow(ConfigurationError);

    try {
      loadEnv(source);
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      expect((error as ConfigurationError).missing).toContain("WEB_ORIGIN");
      expect((error as ConfigurationError).message).not.toContain(
        "service-role-key",
      );
    }
  });

  it("deve falhar quando a porta é inválida", () => {
    expect(() => loadEnv({ ...validEnv, PORT: "abc" })).toThrow(/PORT/);
  });

  it("deve falhar quando uma URL é inválida", () => {
    expect(() => loadEnv({ ...validEnv, WEB_ORIGIN: "not-a-url" })).toThrow(
      /WEB_ORIGIN/,
    );
  });
});
