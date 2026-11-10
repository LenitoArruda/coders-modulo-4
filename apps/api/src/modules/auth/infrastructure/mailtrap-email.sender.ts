import { Inject, Injectable } from "@nestjs/common";
import type { MailtrapClient } from "mailtrap";

import {
  EmailSenderPort,
  type EmailMessage,
} from "../application/ports/email-sender.port";
import { MAIL_FROM, MAILTRAP_CLIENT } from "../auth.tokens";

export type MailFrom = { email: string; name: string };

/** Email adapter that delivers transactional email through the Mailtrap API. */
@Injectable()
export class MailtrapEmailSender extends EmailSenderPort {
  constructor(
    @Inject(MAILTRAP_CLIENT) private readonly client: MailtrapClient,
    @Inject(MAIL_FROM) private readonly from: MailFrom,
  ) {
    super();
  }

  async send(message: EmailMessage): Promise<void> {
    await this.client.send({
      from: this.from,
      to: [{ email: message.to }],
      subject: message.subject,
      text: message.text,
      html: message.html,
      category: "transactional",
    });
  }
}
