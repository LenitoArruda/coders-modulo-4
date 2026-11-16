import { describe, expect, it } from "vitest";

import { loadEnv, type EnvSource } from "../../shared/config/env";

import { createEmailSender } from "./create-email-sender";
import { MailtrapEmailSender } from "./mailtrap-email.sender";
import { ResendEmailSender } from "./resend-email.sender";

const validEnv: EnvSource = {
  WEB_ORIGIN: "http://localhost:3000",
  DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/coders_modulo_4",
  OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4317",
  JWT_SECRET: "test-jwt-secret-with-at-least-32-characters",
  MAILTRAP_API_TOKEN: "test-mailtrap-token",
};

describe("createEmailSender", () => {
  it("deve compor o Mailtrap em ambiente não produtivo", () => {
    const sender = createEmailSender(
      loadEnv({ ...validEnv, NODE_ENV: "development" }),
    );

    expect(sender).toBeInstanceOf(MailtrapEmailSender);
  });

  it("deve compor o Resend quando NODE_ENV=production", () => {
    const sender = createEmailSender(
      loadEnv({
        ...validEnv,
        NODE_ENV: "production",
        RESEND_API_KEY: "test-resend-key",
      }),
    );

    expect(sender).toBeInstanceOf(ResendEmailSender);
  });
});
