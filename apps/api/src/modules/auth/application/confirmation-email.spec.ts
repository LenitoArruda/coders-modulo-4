import { describe, expect, it } from "vitest";

import {
  buildConfirmationEmail,
  CONFIRMATION_EMAIL_SUBJECT,
} from "./confirmation-email";

const user = {
  id: "11111111-1111-1111-1111-111111111111",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
};

describe("buildConfirmationEmail", () => {
  it("deve montar o e-mail en-US com assunto, link e expiração", () => {
    const message = buildConfirmationEmail({
      user,
      confirmationUrl: "http://localhost:3000/auth/confirm?token=clear-token-1",
      expiresAt: new Date("2026-11-11T12:00:00.000Z"),
      ttlSeconds: 86_400,
    });

    expect(message).toMatchObject({
      to: user.email,
      subject: CONFIRMATION_EMAIL_SUBJECT,
    });
    expect(message.subject).toBe("Confirm your account");
    expect(message.text).toContain(
      "http://localhost:3000/auth/confirm?token=clear-token-1",
    );
    expect(message.text).toContain("This link expires in 24 hours");
    expect(message.text).toContain("If you did not create an account");
    expect(message.html).toContain(
      'href="http://localhost:3000/auth/confirm?token=clear-token-1"',
    );
  });

  it("deve usar a duração configurada na mensagem de expiração", () => {
    const message = buildConfirmationEmail({
      user,
      confirmationUrl: "http://localhost:3000/auth/confirm?token=abc",
      expiresAt: new Date("2026-11-10T12:30:00.000Z"),
      ttlSeconds: 1_800,
    });

    expect(message.text).toContain("This link expires in 30 minutes");
  });

  it("deve escapar HTML do nome e do link", () => {
    const message = buildConfirmationEmail({
      user: { ...user, firstName: "<script>alert(1)</script>" },
      confirmationUrl: "http://localhost:3000/auth/confirm?token=a&b=c",
      expiresAt: new Date("2026-11-11T12:00:00.000Z"),
      ttlSeconds: 86_400,
    });

    expect(message.html).not.toContain("<script>");
    expect(message.html).toContain("&lt;script&gt;");
    expect(message.html).toContain("token=a&amp;b=c");
  });
});
