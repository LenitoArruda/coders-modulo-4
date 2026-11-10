import { Inject, Injectable } from "@nestjs/common";
import type { Transporter } from "nodemailer";

import {
  EmailSenderPort,
  type EmailMessage,
} from "../application/ports/email-sender.port";
import { SMTP_FROM, SMTP_TRANSPORT } from "../auth.tokens";

/** SMTP adapter used in development against the local Mailpit. */
@Injectable()
export class SmtpEmailSender extends EmailSenderPort {
  constructor(
    @Inject(SMTP_TRANSPORT) private readonly transport: Transporter,
    @Inject(SMTP_FROM) private readonly from: string,
  ) {
    super();
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transport.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}
