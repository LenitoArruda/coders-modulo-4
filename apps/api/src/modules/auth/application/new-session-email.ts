import type { AuthUser } from "../domain/auth-user";

import type { EmailMessage } from "./ports/email-sender.port";

export const NEW_SESSION_EMAIL_SUBJECT = "New session on your account";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDateTimeUtc(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

/**
 * en-US template for the "new session" notification. It reports when the
 * session started, warns the person if the access is not theirs, and points to
 * the password recovery page.
 */
export function buildNewSessionEmail(
  user: AuthUser,
  accessedAt: Date,
  passwordResetUrl: string,
): EmailMessage {
  const when = `${formatDateTimeUtc(accessedAt)} (UTC)`;
  const greeting = `Hi ${user.firstName},`;
  const text = [
    greeting,
    "",
    "A new session was started on your account.",
    `When: ${when}`,
    "",
    "If you did not start this session, change your password immediately.",
    `Reset your password: ${passwordResetUrl}`,
  ].join("\n");
  const html = `<p>Hi ${escapeHtml(user.firstName)},</p>
<p>A new session was started on your account.</p>
<p>When: <strong>${when}</strong></p>
<p>If you did not start this session, change your password immediately.</p>
<p><a href="${escapeHtml(passwordResetUrl)}">Reset your password</a></p>`;

  return {
    to: user.email,
    subject: NEW_SESSION_EMAIL_SUBJECT,
    text,
    html,
  };
}
