import { describe, expect, it } from "vitest";

import type { AuthUser } from "../domain/auth-user";

import { buildResetPasswordEmail } from "./reset-password-email";

const user: AuthUser = {
  id: "11111111-1111-1111-1111-111111111111",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
};

const expiresAt = new Date("2026-11-10T13:00:00Z");
const resetUrl =
  "http://localhost:3000/auth/reset-password?token=clear-token-1";

describe("buildResetPasswordEmail", () => {
  it("deve montar um e-mail en-US com assunto, link e expiração", () => {
    const message = buildResetPasswordEmail({
      user,
      resetUrl,
      expiresAt,
      ttlSeconds: 3_600,
    });

    expect(message.to).toBe("ada@example.com");
    expect(message.subject).toBe("Reset your password");
    expect(message.text).toContain("Hi Ada,");
    expect(message.text).toContain(`Reset your password: ${resetUrl}`);
    expect(message.text).toContain("This link expires in 1 hour");
    expect(message.text).toContain("can be used only once");
    expect(message.text).toContain(
      "If you did not request a password reset, you can safely ignore this message.",
    );
    expect(message.html).toContain(
      `<a href="${resetUrl}">Reset your password</a>`,
    );
  });

  it("deve renderizar a duração em minutos quando não é múltipla de hora", () => {
    const message = buildResetPasswordEmail({
      user,
      resetUrl,
      expiresAt,
      ttlSeconds: 90,
    });

    expect(message.text).toContain("This link expires in 2 minutes");
  });

  it("deve escapar HTML no primeiro nome e na URL", () => {
    const message = buildResetPasswordEmail({
      user: { ...user, firstName: "Ada <script>" },
      resetUrl: "http://localhost:3000/auth/reset-password?token=<bad>",
      expiresAt,
      ttlSeconds: 3_600,
    });

    expect(message.html).not.toContain("<script>");
    expect(message.html).toContain("Ada &lt;script&gt;");
    expect(message.html).not.toContain("token=<bad>");
    expect(message.html).toContain("token=&lt;bad&gt;");
  });
});
