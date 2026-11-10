import type { AuthUser } from "../domain/auth-user";

import type { EmailMessage } from "./ports/email-sender.port";

export const PASSWORD_CHANGED_EMAIL_SUBJECT = "Your password has been changed";

export type PasswordChangedEmailInput = {
  user: AuthUser;
  /** Absolute URL to the web forgot-password page, for an unrecognized change. */
  forgotPasswordUrl: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** en-US confirmation sent after a successful password reset. */
export function buildPasswordChangedEmail(
  input: PasswordChangedEmailInput,
): EmailMessage {
  const text = [
    `Hi ${input.user.firstName},`,
    "",
    "The password for your Experts account was just changed, and every active session was signed out.",
    "",
    `If you did not make this change, request a new password reset right away: ${input.forgotPasswordUrl}`,
  ].join("\n");
  const html = `<p>Hi ${escapeHtml(input.user.firstName)},</p>
<p>The password for your Experts account was just changed, and every active session was signed out.</p>
<p>If you did not make this change, <a href="${escapeHtml(input.forgotPasswordUrl)}">request a new password reset</a> right away.</p>`;

  return {
    to: input.user.email,
    subject: PASSWORD_CHANGED_EMAIL_SUBJECT,
    text,
    html,
  };
}
