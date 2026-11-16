import type { MailtrapClient } from "mailtrap";

import {
  EmailSenderPort,
  type EmailMessage,
} from "../application/ports/email-sender.port";

import type { MailFrom } from "./mail-from";

/** Email adapter that delivers transactional email through the Mailtrap API. */
export class MailtrapEmailSender extends EmailSenderPort {
  constructor(
    private readonly client: MailtrapClient,
    private readonly from: MailFrom,
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
