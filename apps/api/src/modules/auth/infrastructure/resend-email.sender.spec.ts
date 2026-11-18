import { describe, expect, it, vi } from "vitest";

import type { EmailMessage } from "../application/ports/email-sender.port";

import { ResendEmailError, ResendEmailSender } from "./resend-email.sender";

const message: EmailMessage = {
  to: "user@example.com",
  subject: "Confirm your account",
  text: "Plain text body",
  html: "<p>HTML body</p>",
};

const from = { email: "no-reply@example.com", name: "Experts" };

describe("ResendEmailSender", () => {
  it("deve enviar o e-mail pela API do Resend com remetente e conteúdo", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl.mockResolvedValue(new Response(null, { status: 200 }));

    const sender = new ResendEmailSender("test-resend-key", from, fetchImpl);

    await sender.send(message);

    const call = fetchImpl.mock.calls[0];
    const init = call?.[1];

    expect(call?.[0]).toBe("https://api.resend.com/emails");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({
      Authorization: "Bearer test-resend-key",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      from: "Experts <no-reply@example.com>",
      to: ["user@example.com"],
      subject: "Confirm your account",
      text: "Plain text body",
      html: "<p>HTML body</p>",
    });
  });

  it("deve falhar com o status do provedor sem expor a chave ou o corpo", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl.mockResolvedValue(
      new Response("secret response body", { status: 422 }),
    );

    const sender = new ResendEmailSender("test-resend-key", from, fetchImpl);

    await expect(sender.send(message)).rejects.toMatchObject({
      name: "ResendEmailError",
      status: 422,
      message: "Resend API responded with status 422",
    });

    try {
      await sender.send(message);
    } catch (error) {
      expect(String(error)).not.toContain("test-resend-key");
      expect(String(error)).not.toContain("secret response body");
    }
  });

  it("deve expor um erro tipado quando o Resend responde com falha", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl.mockResolvedValue(new Response(null, { status: 500 }));

    const sender = new ResendEmailSender("test-resend-key", from, fetchImpl);

    await expect(sender.send(message)).rejects.toBeInstanceOf(ResendEmailError);
  });
});
