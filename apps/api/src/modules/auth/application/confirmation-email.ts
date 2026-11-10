import type { AuthUser } from "../domain/auth-user";

import type { EmailMessage } from "./ports/email-sender.port";

export const CONFIRMATION_EMAIL_SUBJECT = "Confirm your account";

export type ConfirmationEmailInput = {
  user: AuthUser;
  /** Absolute URL to the web confirmation page, including the clear token. */
  confirmationUrl: string;
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
 * en-US template for the email confirmation link. The clear token only exists
 * in the URL: it is never stored here and must not be logged by callers.
 */
export function buildConfirmationEmail(
  input: ConfirmationEmailInput,
): EmailMessage {
  const when = `${formatDateTimeUtc(input.expiresAt)} UTC`;
  const duration = formatDuration(input.ttlSeconds);
  const text = [
    `Hi ${input.user.firstName},`,
    "",
    "Confirm your email address to finish creating your Experts account.",
    "",
    `Confirm your email: ${input.confirmationUrl}`,
    "",
    `This link expires in ${duration} (on ${when}).`,
    "",
    "If you did not create an account, you can safely ignore this message.",
  ].join("\n");
  const html = `<p>Hi ${escapeHtml(input.user.firstName)},</p>
<p>Confirm your email address to finish creating your Experts account.</p>
<p><a href="${escapeHtml(input.confirmationUrl)}">Confirm your email</a></p>
<p>This link expires in ${duration} (on ${when}).</p>
<p>If you did not create an account, you can safely ignore this message.</p>`;

  return {
    to: input.user.email,
    subject: CONFIRMATION_EMAIL_SUBJECT,
    text,
    html,
  };
}
