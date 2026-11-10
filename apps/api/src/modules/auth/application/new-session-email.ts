import type { AuthUser } from "../domain/auth-user";

import { renderEmailLayout } from "./email-layout";
import type { EmailMessage } from "./ports/email-sender.port";

export const NEW_SESSION_EMAIL_SUBJECT = "New session on your account";

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
  const html = renderEmailLayout({
    title: "New session on your account",
    preheader: "A new session was started on your Experts account.",
    greeting,
    blocks: [
      {
        type: "paragraph",
        text: "A new session was started on your account.",
      },
      { type: "details", items: [{ label: "When", value: when }] },
      {
        type: "paragraph",
        text: "If you did not start this session, change your password immediately.",
      },
      { type: "action", label: "Reset your password", url: passwordResetUrl },
    ],
  });

  return {
    to: user.email,
    subject: NEW_SESSION_EMAIL_SUBJECT,
    text,
    html,
  };
}
