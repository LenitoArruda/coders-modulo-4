import { describe, expect, it } from "vitest";

import type { AuthUser } from "../domain/auth-user";

import { buildPasswordChangedEmail } from "./password-changed-email";

const user: AuthUser = {
  id: "11111111-1111-1111-1111-111111111111",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
};

const forgotPasswordUrl = "http://localhost:3000/auth/forgot-password";

describe("buildPasswordChangedEmail", () => {
  it("deve montar um e-mail en-US informando a alteração e orientando novo reset", () => {
    const message = buildPasswordChangedEmail({ user, forgotPasswordUrl });

    expect(message.to).toBe("ada@example.com");
    expect(message.subject).toBe("Your password has been changed");
    expect(message.text).toContain("Hi Ada,");
    expect(message.text).toContain("was just changed");
    expect(message.text).toContain("If you did not make this change");
    expect(message.text).toContain(forgotPasswordUrl);
    expect(message.html).toContain(`href="${forgotPasswordUrl}"`);
  });

  it("deve escapar HTML no primeiro nome e na URL", () => {
    const message = buildPasswordChangedEmail({
      user: { ...user, firstName: "Ada <script>" },
      forgotPasswordUrl: 'http://localhost:3000/"><b>',
    });

    expect(message.html).not.toContain("<script>");
    expect(message.html).toContain("Ada &lt;script&gt;");
    expect(message.html).not.toContain('"><b>');
  });

  it("não deve conter senha nem token", () => {
    const message = buildPasswordChangedEmail({ user, forgotPasswordUrl });

    expect(message.text).not.toMatch(/token=|password:/i);
  });
});
