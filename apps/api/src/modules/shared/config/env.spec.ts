import { describe, expect, it } from "vitest";

import { ConfigurationError, loadEnv, type EnvSource } from "./env";

const validEnv: EnvSource = {
  PORT: "3333",
  WEB_ORIGIN: "http://localhost:3000",
  DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/coders_modulo_4",
  OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4317",
  JWT_SECRET: "test-jwt-secret-with-at-least-32-characters",
  MAILTRAP_API_TOKEN: "test-mailtrap-token",
};

describe("loadEnv", () => {
  it("deve carregar uma configuração válida", () => {
    expect(loadEnv(validEnv)).toMatchObject({
      port: 3333,
      webOrigin: "http://localhost:3000",
      databaseUrl:
        "postgresql://postgres:postgres@127.0.0.1:5432/coders_modulo_4",
      serviceName: "coders-modulo-4-api",
      jwtSecret: "test-jwt-secret-with-at-least-32-characters",
      sessionTtlSeconds: 604_800,
      confirmationTokenTtlSeconds: 86_400,
      signUpRateLimitMax: 5,
      signUpRateLimitWindowSeconds: 60,
      confirmationRateLimitMax: 10,
      confirmationRateLimitWindowSeconds: 60,
      resetTokenTtlSeconds: 3_600,
      forgotPasswordRateLimitMax: 5,
      forgotPasswordRateLimitWindowSeconds: 60,
      mailtrapApiToken: "test-mailtrap-token",
      mailFromEmail: "hello@demomailtrap.co",
      mailFromName: "Experts",
    });
  });

  it("deve assumir dev e Mailtrap quando NODE_ENV está ausente", () => {
    expect(loadEnv(validEnv)).toMatchObject({
      nodeEnv: "dev",
      emailProvider: "mailtrap",
      resendApiKey: "",
      mailtrapApiToken: "test-mailtrap-token",
    });
  });

  it("deve assumir dev quando NODE_ENV está vazio", () => {
    expect(loadEnv({ ...validEnv, NODE_ENV: "   " })).toMatchObject({
      nodeEnv: "dev",
      emailProvider: "mailtrap",
    });
  });

  it("deve selecionar Mailtrap para valores não produtivos", () => {
    for (const nodeEnv of ["dev", "development", "test", "staging", "prod"]) {
      expect(loadEnv({ ...validEnv, NODE_ENV: nodeEnv })).toMatchObject({
        nodeEnv,
        emailProvider: "mailtrap",
        resendApiKey: "",
      });
    }
  });

  it("deve selecionar Resend quando NODE_ENV=production", () => {
    expect(
      loadEnv({
        ...validEnv,
        NODE_ENV: "production",
        RESEND_API_KEY: "test-resend-key",
      }),
    ).toMatchObject({
      nodeEnv: "production",
      emailProvider: "resend",
      resendApiKey: "test-resend-key",
      mailtrapApiToken: "",
      mailtrapSandbox: false,
      mailtrapSandboxId: null,
    });
  });

  it("deve normalizar NODE_ENV com espaços e capitalização", () => {
    expect(
      loadEnv({
        ...validEnv,
        NODE_ENV: " Production ",
        RESEND_API_KEY: "test-resend-key",
      }),
    ).toMatchObject({
      nodeEnv: "production",
      emailProvider: "resend",
    });
  });

  it("deve exigir apenas RESEND_API_KEY quando Resend é o provedor ativo", () => {
    const source = {
      ...validEnv,
      NODE_ENV: "production",
      MAILTRAP_API_TOKEN: undefined,
    };

    expect(() => loadEnv(source)).toThrow(/RESEND_API_KEY/);

    expect(
      loadEnv({ ...source, RESEND_API_KEY: "test-resend-key" }),
    ).toMatchObject({
      emailProvider: "resend",
      mailtrapApiToken: "",
    });
  });

  it("deve exigir apenas MAILTRAP_API_TOKEN quando Mailtrap é o provedor ativo", () => {
    expect(
      loadEnv({
        ...validEnv,
        NODE_ENV: "development",
        RESEND_API_KEY: undefined,
      }),
    ).toMatchObject({
      emailProvider: "mailtrap",
      resendApiKey: "",
    });

    expect(() =>
      loadEnv({
        ...validEnv,
        NODE_ENV: "development",
        MAILTRAP_API_TOKEN: undefined,
      }),
    ).toThrow(/MAILTRAP_API_TOKEN/);
  });

  it("deve ignorar variáveis inválidas do provedor inativo", () => {
    expect(
      loadEnv({
        ...validEnv,
        NODE_ENV: "production",
        RESEND_API_KEY: "test-resend-key",
        MAILTRAP_SANDBOX: "maybe",
        MAILTRAP_SANDBOX_ID: "0",
      }),
    ).toMatchObject({
      emailProvider: "resend",
      mailtrapSandbox: false,
      mailtrapSandboxId: null,
    });

    expect(
      loadEnv({
        ...validEnv,
        NODE_ENV: "development",
        RESEND_API_KEY: "ignored",
        MAILTRAP_SANDBOX: "false",
      }),
    ).toMatchObject({
      emailProvider: "mailtrap",
      mailtrapSandbox: false,
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

  it("deve falhar quando a URL do banco está ausente", () => {
    const source = { ...validEnv, DATABASE_URL: undefined };

    try {
      loadEnv(source);
      expect.unreachable("loadEnv deveria lançar ConfigurationError");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      expect((error as ConfigurationError).missing).toContain("DATABASE_URL");
    }
  });

  it("deve falhar quando a URL do banco não é PostgreSQL", () => {
    expect(() =>
      loadEnv({ ...validEnv, DATABASE_URL: "mysql://user:pass@localhost/db" }),
    ).toThrow(/DATABASE_URL/);

    expect(() => loadEnv({ ...validEnv, DATABASE_URL: "not-a-url" })).toThrow(
      /DATABASE_URL/,
    );
  });

  it("deve aceitar postgres:// e postgresql://", () => {
    expect(
      loadEnv({ ...validEnv, DATABASE_URL: "postgres://u:p@localhost:5432/db" })
        .databaseUrl,
    ).toBe("postgres://u:p@localhost:5432/db");

    expect(
      loadEnv({
        ...validEnv,
        DATABASE_URL: "postgresql://u:p@localhost:5432/db",
      }).databaseUrl,
    ).toBe("postgresql://u:p@localhost:5432/db");
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

  it("deve aplicar a configuração de sign-in quando informada", () => {
    expect(
      loadEnv({
        ...validEnv,
        SIGN_IN_RATE_LIMIT_MAX: "20",
        SIGN_IN_RATE_LIMIT_WINDOW_SECONDS: "30",
      }),
    ).toMatchObject({
      signInRateLimitMax: 20,
      signInRateLimitWindowSeconds: 30,
    });
  });

  it("deve usar os padrões e falhar quando a configuração de sign-in é inválida", () => {
    expect(loadEnv(validEnv)).toMatchObject({
      signInRateLimitMax: 5,
      signInRateLimitWindowSeconds: 60,
    });

    expect(() => loadEnv({ ...validEnv, SIGN_IN_RATE_LIMIT_MAX: "0" })).toThrow(
      /SIGN_IN_RATE_LIMIT_MAX/,
    );

    expect(() =>
      loadEnv({ ...validEnv, SIGN_IN_RATE_LIMIT_WINDOW_SECONDS: "abc" }),
    ).toThrow(/SIGN_IN_RATE_LIMIT_WINDOW_SECONDS/);
  });

  it("deve aplicar a configuração de recuperação de senha quando informada", () => {
    expect(
      loadEnv({
        ...validEnv,
        RESET_TOKEN_TTL_SECONDS: "7200",
        FORGOT_PASSWORD_RATE_LIMIT_MAX: "10",
        FORGOT_PASSWORD_RATE_LIMIT_WINDOW_SECONDS: "120",
      }),
    ).toMatchObject({
      resetTokenTtlSeconds: 7_200,
      forgotPasswordRateLimitMax: 10,
      forgotPasswordRateLimitWindowSeconds: 120,
    });
  });

  it("deve falhar quando a configuração de recuperação de senha é inválida", () => {
    expect(() =>
      loadEnv({ ...validEnv, RESET_TOKEN_TTL_SECONDS: "abc" }),
    ).toThrow(/RESET_TOKEN_TTL_SECONDS/);

    expect(() =>
      loadEnv({ ...validEnv, FORGOT_PASSWORD_RATE_LIMIT_MAX: "0" }),
    ).toThrow(/FORGOT_PASSWORD_RATE_LIMIT_MAX/);

    expect(() =>
      loadEnv({ ...validEnv, FORGOT_PASSWORD_RATE_LIMIT_WINDOW_SECONDS: "0" }),
    ).toThrow(/FORGOT_PASSWORD_RATE_LIMIT_WINDOW_SECONDS/);
  });

  it("deve aplicar o rate limit do reset de senha e usar 5/60 s por padrão", () => {
    expect(loadEnv(validEnv)).toMatchObject({
      resetPasswordRateLimitMax: 5,
      resetPasswordRateLimitWindowSeconds: 60,
    });

    expect(
      loadEnv({
        ...validEnv,
        RESET_PASSWORD_RATE_LIMIT_MAX: "9",
        RESET_PASSWORD_RATE_LIMIT_WINDOW_SECONDS: "90",
      }),
    ).toMatchObject({
      resetPasswordRateLimitMax: 9,
      resetPasswordRateLimitWindowSeconds: 90,
    });
  });

  it("deve falhar quando o rate limit do reset de senha é inválido", () => {
    expect(() =>
      loadEnv({ ...validEnv, RESET_PASSWORD_RATE_LIMIT_MAX: "0" }),
    ).toThrow(/RESET_PASSWORD_RATE_LIMIT_MAX/);

    expect(() =>
      loadEnv({ ...validEnv, RESET_PASSWORD_RATE_LIMIT_WINDOW_SECONDS: "abc" }),
    ).toThrow(/RESET_PASSWORD_RATE_LIMIT_WINDOW_SECONDS/);
  });

  it("deve falhar quando o token do Mailtrap está ausente", () => {
    expect(() =>
      loadEnv({ ...validEnv, MAILTRAP_API_TOKEN: undefined }),
    ).toThrow(/MAILTRAP_API_TOKEN/);
  });

  it("deve falhar quando o remetente do e-mail é inválido", () => {
    expect(() =>
      loadEnv({ ...validEnv, MAIL_FROM_EMAIL: "not-an-email" }),
    ).toThrow(/MAIL_FROM_EMAIL/);
  });

  it("deve aplicar os overrides do remetente quando informados", () => {
    expect(
      loadEnv({
        ...validEnv,
        MAIL_FROM_EMAIL: "no-reply@example.com",
        MAIL_FROM_NAME: "Acme",
      }),
    ).toMatchObject({
      mailFromEmail: "no-reply@example.com",
      mailFromName: "Acme",
    });
  });

  it("deve desativar a sandbox do Mailtrap por padrão", () => {
    expect(loadEnv(validEnv)).toMatchObject({
      mailtrapSandbox: false,
      mailtrapSandboxId: null,
    });
  });

  it("deve ativar a sandbox do Mailtrap com o ID da inbox", () => {
    expect(
      loadEnv({
        ...validEnv,
        MAILTRAP_SANDBOX: "true",
        MAILTRAP_SANDBOX_ID: "5014471",
      }),
    ).toMatchObject({
      mailtrapSandbox: true,
      mailtrapSandboxId: 5_014_471,
    });
  });

  it("deve falhar quando a sandbox do Mailtrap está ativa sem o ID da inbox", () => {
    expect(() => loadEnv({ ...validEnv, MAILTRAP_SANDBOX: "true" })).toThrow(
      /MAILTRAP_SANDBOX_ID/,
    );
  });

  it("deve falhar quando o ID da sandbox do Mailtrap é inválido", () => {
    expect(() =>
      loadEnv({
        ...validEnv,
        MAILTRAP_SANDBOX: "true",
        MAILTRAP_SANDBOX_ID: "0",
      }),
    ).toThrow(/MAILTRAP_SANDBOX_ID/);
  });

  it("deve falhar quando a flag da sandbox do Mailtrap é inválida", () => {
    expect(() => loadEnv({ ...validEnv, MAILTRAP_SANDBOX: "maybe" })).toThrow(
      /MAILTRAP_SANDBOX/,
    );
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
        "postgres:postgres",
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

  it("deve manter mídia desativada por padrão com limites seguros", () => {
    expect(loadEnv(validEnv)).toMatchObject({
      multimediaDeliverablesEnabled: false,
      mediaImageModelId: "gpt-image-2",
      mediaVideoModelId: "gemini-omni-1.2-flash",
      mediaImageQuotaPerHour: 10,
      mediaVideoQuotaPerHour: 2,
      mediaQuotaWindowSeconds: 3600,
      mediaMaxFileBytes: 20 * 1024 * 1024,
      openaiApiBaseUrl: "https://api.openai.com",
      geminiApiBaseUrl: "https://generativelanguage.googleapis.com",
    });
  });

  it("deve aceitar a flag de mídia e limites configurados", () => {
    expect(
      loadEnv({
        ...validEnv,
        MULTIMEDIA_DELIVERABLES_ENABLED: "true",
        MEDIA_IMAGE_QUOTA_PER_HOUR: "3",
        MEDIA_VIDEO_QUOTA_PER_HOUR: "1",
        MEDIA_MAX_FILE_BYTES: "1048576",
        OPENAI_API_BASE_URL: "http://127.0.0.1:3437",
        GEMINI_API_BASE_URL: "http://127.0.0.1:3437",
      }),
    ).toMatchObject({
      multimediaDeliverablesEnabled: true,
      mediaImageQuotaPerHour: 3,
      mediaVideoQuotaPerHour: 1,
      mediaMaxFileBytes: 1048576,
      openaiApiBaseUrl: "http://127.0.0.1:3437",
      geminiApiBaseUrl: "http://127.0.0.1:3437",
    });
  });

  it("deve rejeitar limites de mídia fora da faixa", () => {
    expect(() =>
      loadEnv({ ...validEnv, MEDIA_VIDEO_QUOTA_PER_HOUR: "0" }),
    ).toThrow(/MEDIA_VIDEO_QUOTA_PER_HOUR/);
    expect(() =>
      loadEnv({ ...validEnv, GEMINI_API_BASE_URL: "ftp://example.com" }),
    ).toThrow(/GEMINI_API_BASE_URL/);
  });
});
