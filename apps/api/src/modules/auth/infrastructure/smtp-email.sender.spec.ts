import type { Transporter } from "nodemailer";
import { describe, expect, it, vi } from "vitest";

import type { EmailMessage } from "../application/ports/email-sender.port";

import { SmtpEmailSender } from "./smtp-email.sender";

const message: EmailMessage = {
  to: "ada@example.com",
  subject: "New session on your account",
  text: "Hi Ada",
  html: "<p>Hi Ada</p>",
};

function createSender(sendMail: ReturnType<typeof vi.fn>) {
  return new SmtpEmailSender(
    { sendMail } as unknown as Transporter,
    "no-reply@localhost",
  );
}

describe("SmtpEmailSender", () => {
  it("deve enviar a mensagem com remetente, destinatário e conteúdo", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "id" });

    await createSender(sendMail).send(message);

    expect(sendMail).toHaveBeenCalledWith({
      from: "no-reply@localhost",
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  });

  it("deve propagar a falha de envio para quem chamou", async () => {
    const sendMail = vi.fn().mockRejectedValue(new Error("connection refused"));

    await expect(createSender(sendMail).send(message)).rejects.toThrow(
      "connection refused",
    );
  });
});
