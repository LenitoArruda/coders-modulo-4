import { MailtrapClient } from "mailtrap";

import type { Env } from "../../shared/config/env";
import { EmailSenderPort } from "../application/ports/email-sender.port";

import { MailtrapEmailSender } from "./mailtrap-email.sender";
import type { MailFrom } from "./mail-from";
import { ResendEmailSender } from "./resend-email.sender";

function createMailtrapClient(env: Env): MailtrapClient {
  // Local development can route email to a Mailtrap sandbox, which is
  // addressed by its sandbox (inbox) ID and accepts sandbox-scoped tokens.
  if (env.mailtrapSandbox && env.mailtrapSandboxId !== null) {
    return new MailtrapClient({
      token: env.mailtrapApiToken,
      sandbox: true,
      sandboxId: env.mailtrapSandboxId,
    });
  }

  return new MailtrapClient({ token: env.mailtrapApiToken });
}

/**
 * Composition root for transactional email: the validated environment decides
 * which concrete adapter is bound to `EmailSenderPort`.
 */
export function createEmailSender(env: Env): EmailSenderPort {
  const from: MailFrom = {
    email: env.mailFromEmail,
    name: env.mailFromName,
  };

  if (env.emailProvider === "resend") {
    return new ResendEmailSender(env.resendApiKey, from);
  }

  return new MailtrapEmailSender(createMailtrapClient(env), from);
}
