import {
  EmailSenderPort,
  type EmailMessage,
} from "../../modules/auth/application/ports/email-sender.port";

/** Records every message so tests can assert what was dispatched. */
export class InMemoryEmailSender extends EmailSenderPort {
  readonly messages: EmailMessage[] = [];

  /** When set, `send` rejects with this error to simulate delivery failures. */
  failure: Error | null = null;

  async send(message: EmailMessage): Promise<void> {
    if (this.failure) {
      throw this.failure;
    }

    this.messages.push(message);
  }
}
