import type { AuthUser } from "../domain/auth-user";

import type { EmailMessage } from "./ports/email-sender.port";

export const RESET_PASSWORD_EMAIL_SUBJECT = "Reset your password";

export type ResetPasswordEmailInput = {
  user: AuthUser;
  /** Absolute URL to the web reset page, including the clear token. */
  resetUrl: string;
  expiresAt: Date;
  /** Token lifetime, used only to render the human-readable expiry notice. */
  ttlSeconds: number;
};

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

function formatDuration(seconds: number): string {
  if (seconds % 3_600 === 0) {
    const hours = seconds / 3_600;

    return hours === 1 ? "1 hour" : `${hours} hours`;
  }

  const minutes = Math.max(1, Math.round(seconds / 60));

  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

/**
 * en-US template for the password recovery link. The clear token only exists
 * in the URL: callers must never log it.
 */
export function buildResetPasswordEmail(
  input: ResetPasswordEmailInput,
): EmailMessage {
  const when = `${formatDateTimeUtc(input.expiresAt)} UTC`;
  const duration = formatDuration(input.ttlSeconds);
  const text = [
    `Hi ${input.user.firstName},`,
    "",
    "We received a request to reset the password for your Experts account.",
    "",
    `Reset your password: ${input.resetUrl}`,
    "",
    `This link expires in ${duration} (on ${when}) and can be used only once.`,
    "",
    "If you did not request a password reset, you can safely ignore this message. Your password will not change.",
  ].join("\n");
  const html = `<p>Hi ${escapeHtml(input.user.firstName)},</p>
<p>We received a request to reset the password for your Experts account.</p>
<p><a href="${escapeHtml(input.resetUrl)}">Reset your password</a></p>
<p>This link expires in ${duration} (on ${when}) and can be used only once.</p>
<p>If you did not request a password reset, you can safely ignore this message. Your password will not change.</p>`;

  return {
    to: input.user.email,
    subject: RESET_PASSWORD_EMAIL_SUBJECT,
    text,
    html,
  };
}
