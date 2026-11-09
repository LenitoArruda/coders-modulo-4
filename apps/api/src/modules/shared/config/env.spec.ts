import { describe, expect, it } from "vitest";

import { ConfigurationError, loadEnv, type EnvSource } from "./env";

const validEnv: EnvSource = {
  PORT: "3333",
  WEB_ORIGIN: "http://localhost:3000",
  SUPABASE_URL: "http://localhost:54321",
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4317",
};

describe("loadEnv", () => {
  it("deve carregar uma configuração válida", () => {
    expect(loadEnv(validEnv)).toMatchObject({
      port: 3333,
      webOrigin: "http://localhost:3000",
      serviceName: "coders-modulo-4-api",
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
