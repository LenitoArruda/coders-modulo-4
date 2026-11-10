import type { AuthUser } from "../domain/auth-user";

import { renderEmailLayout } from "./email-layout";
import type { EmailMessage } from "./ports/email-sender.port";

export const PASSWORD_CHANGED_EMAIL_SUBJECT = "Your password has been changed";

export type PasswordChangedEmailInput = {
  user: AuthUser;
  /** Absolute URL to the web forgot-password page, for an unrecognized change. */
  forgotPasswordUrl: string;
};

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
  const html = renderEmailLayout({
    title: "Your password has been changed",
    preheader:
      "Your Experts password was changed and every session was signed out.",
    greeting: `Hi ${input.user.firstName},`,
    blocks: [
      {
        type: "paragraph",
        text: "The password for your Experts account was just changed, and every active session was signed out.",
      },
      {
        type: "note",
        text: "If you did not make this change, request a new password reset right away.",
      },
      {
        type: "action",
        label: "Request a password reset",
        url: input.forgotPasswordUrl,
      },
    ],
  });

  return {
    to: input.user.email,
    subject: PASSWORD_CHANGED_EMAIL_SUBJECT,
    text,
    html,
  };
}
