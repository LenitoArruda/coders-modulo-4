import type { AuthUser } from "../domain/auth-user";

import { renderEmailLayout } from "./email-layout";
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
  const html = renderEmailLayout({
    title: "Reset your password",
    preheader:
      "Use this link to choose a new password for your Experts account.",
    greeting: `Hi ${input.user.firstName},`,
    blocks: [
      {
        type: "paragraph",
        text: "We received a request to reset the password for your Experts account.",
      },
      { type: "action", label: "Reset your password", url: input.resetUrl },
      {
        type: "note",
        text: `This link expires in ${duration} (on ${when}) and can be used only once.`,
      },
      {
        type: "note",
        text: "If you did not request a password reset, you can safely ignore this message. Your password will not change.",
      },
    ],
  });

  return {
    to: input.user.email,
    subject: RESET_PASSWORD_EMAIL_SUBJECT,
    text,
    html,
  };
}
