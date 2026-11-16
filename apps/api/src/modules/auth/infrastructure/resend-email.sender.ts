import {
  EmailSenderPort,
  type EmailMessage,
} from "../application/ports/email-sender.port";

import { formatMailFrom, type MailFrom } from "./mail-from";

const RESEND_API_URL = "https://api.resend.com/emails";
const REQUEST_TIMEOUT_MS = 10_000;

/** Error that exposes only the provider status, never its response body. */
export class ResendEmailError extends Error {
  constructor(readonly status: number) {
    super(`Resend API responded with status ${status}`);
    this.name = "ResendEmailError";
  }
}

/** Email adapter that delivers transactional email through the Resend API. */
export class ResendEmailSender extends EmailSenderPort {
  constructor(
    private readonly apiKey: string,
    private readonly from: MailFrom,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    super();
  }

  async send(message: EmailMessage): Promise<void> {
    const response = await this.fetchImpl(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: formatMailFrom(this.from),
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new ResendEmailError(response.status);
    }
  }
}
