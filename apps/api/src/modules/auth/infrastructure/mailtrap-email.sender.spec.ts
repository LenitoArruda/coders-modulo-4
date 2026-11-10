import type { MailtrapClient } from "mailtrap";
import { describe, expect, it, vi } from "vitest";

import type { EmailMessage } from "../application/ports/email-sender.port";

import { MailtrapEmailSender } from "./mailtrap-email.sender";

const message: EmailMessage = {
  to: "ada@example.com",
  subject: "New session on your account",
  text: "Hi Ada",
  html: "<p>Hi Ada</p>",
};

const from = { email: "hello@example.com", name: "Experts" };

function createSender(send: ReturnType<typeof vi.fn>) {
  return new MailtrapEmailSender({ send } as unknown as MailtrapClient, from);
}

describe("MailtrapEmailSender", () => {
  it("deve enviar a mensagem com remetente, destinatário e conteúdo", async () => {
    const send = vi.fn().mockResolvedValue({ success: true });

    await createSender(send).send(message);

    expect(send).toHaveBeenCalledWith({
      from,
      to: [{ email: message.to }],
      subject: message.subject,
      text: message.text,
      html: message.html,
      category: "transactional",
    });
  });

  it("deve propagar a falha de envio para quem chamou", async () => {
    const send = vi.fn().mockRejectedValue(new Error("unauthorized"));

    await expect(createSender(send).send(message)).rejects.toThrow(
      "unauthorized",
    );
  });
});
