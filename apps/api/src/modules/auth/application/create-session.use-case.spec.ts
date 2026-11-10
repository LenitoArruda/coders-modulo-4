import { describe, expect, it } from "vitest";

import type { AuthUser } from "../domain/auth-user";
import type { Session } from "../domain/session";

import { CreateSessionUseCase } from "./create-session.use-case";
import { buildNewSessionEmail } from "./new-session-email";
import { FakeSessionToken } from "../../../test/fakes/fake-session-token";
import { InMemoryEmailSender } from "../../../test/fakes/in-memory-email.sender";
import { InMemorySessionsRepository } from "../../../test/fakes/in-memory-sessions.repository";

const user: AuthUser = {
  id: "11111111-1111-1111-1111-111111111111",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
};

describe("CreateSessionUseCase", () => {
  it("deve persistir a sessão com origin e expiração configuráveis", async () => {
    const sessions = new InMemorySessionsRepository();
    const useCase = new CreateSessionUseCase(
      sessions,
      new FakeSessionToken(),
      new InMemoryEmailSender(),
      3600,
    );

    const { session } = await useCase.execute({ user, origin: "sign_in" });

    expect(session.userId).toBe(user.id);
    expect(session.origin).toBe("sign_in");
    expect(session.revokedAt).toBeNull();
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(session.expiresAt.getTime()).toBeLessThanOrEqual(
      Date.now() + 3600 * 1000,
    );
    expect(sessions.sessions).toHaveLength(1);
  });

  it("deve revogar as sessões ativas anteriores e manter apenas a nova", async () => {
    const sessions = new InMemorySessionsRepository();
    const previous = sessions.seed({
      userId: user.id,
      origin: "sign_up_confirmation",
      createdAt: new Date(Date.now() - 60_000),
      expiresAt: new Date(Date.now() + 3_600_000),
      revokedAt: null,
    });
    const expired = sessions.seed({
      userId: user.id,
      origin: "sign_in",
      createdAt: new Date(Date.now() - 7_200_000),
      expiresAt: new Date(Date.now() - 60_000),
      revokedAt: null,
    });
    const useCase = new CreateSessionUseCase(
      sessions,
      new FakeSessionToken(),
      new InMemoryEmailSender(),
      3600,
    );

    const { session } = await useCase.execute({ user, origin: "sign_in" });

    expect(previous.revokedAt).not.toBeNull();
    expect(expired.revokedAt).toBeNull();
    expect(session.revokedAt).toBeNull();

    const active = await Promise.all(
      sessions.sessions.map((candidate) =>
        sessions.findActiveById(candidate.id),
      ),
    );

    expect(active.filter((candidate) => candidate !== null)).toEqual([session]);
  });

  it("não deve revogar sessões de outra pessoa", async () => {
    const sessions = new InMemorySessionsRepository();
    const otherUser = sessions.seed({
      userId: "22222222-2222-2222-2222-222222222222",
      origin: "sign_in",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 3_600_000),
      revokedAt: null,
    });
    const useCase = new CreateSessionUseCase(
      sessions,
      new FakeSessionToken(),
      new InMemoryEmailSender(),
      3600,
    );

    await useCase.execute({ user, origin: "sign_in" });

    expect(otherUser.revokedAt).toBeNull();
  });

  it("deve assinar o JWT com sub e sid da nova sessão", async () => {
    const sessions = new InMemorySessionsRepository();
    const tokens = new FakeSessionToken();
    const useCase = new CreateSessionUseCase(
      sessions,
      tokens,
      new InMemoryEmailSender(),
      3600,
    );

    const { token, session } = await useCase.execute({
      user,
      origin: "sign_up_confirmation",
    });

    expect(tokens.signed).toEqual([{ userId: user.id, sessionId: session.id }]);
    expect(token).toContain(session.id);
  });

  it("deve disparar o e-mail de nova sessão para a pessoa", async () => {
    const emails = new InMemoryEmailSender();
    const sessions = new InMemorySessionsRepository();
    const useCase = new CreateSessionUseCase(
      sessions,
      new FakeSessionToken(),
      emails,
      3600,
    );

    const { session } = await useCase.execute({ user, origin: "sign_in" });

    expect(emails.messages).toHaveLength(1);
    expect(emails.messages[0]).toMatchObject({
      to: "ada@example.com",
      subject: "New session on your account",
    });
    expect(emails.messages[0]?.text).toContain("change your password");
    expect(emails.messages[0]?.text).not.toContain(session.id);
  });

  it("deve manter a sessão válida quando o envio do e-mail falha", async () => {
    const emails = new InMemoryEmailSender();
    emails.failure = new Error("connection refused to smtp 54325");
    const sessions = new InMemorySessionsRepository();
    const useCase = new CreateSessionUseCase(
      sessions,
      new FakeSessionToken(),
      emails,
      3600,
    );

    const result = await useCase.execute({ user, origin: "sign_in" });

    const active: Session | null = await sessions.findActiveById(
      result.session.id,
    );

    expect(active).not.toBeNull();
    expect(result.token).toContain(result.session.id);
  });
});

describe("buildNewSessionEmail (usado pelo caso de uso)", () => {
  it("deve ser en-US com data/hora e alerta, sem link de recuperação", () => {
    const message = buildNewSessionEmail(
      user,
      new Date("2026-11-09T15:42:00Z"),
    );

    expect(message.subject).toBe("New session on your account");
    expect(message.to).toBe("ada@example.com");
    expect(message.text).toContain("Hi Ada,");
    expect(message.text).toMatch(/When: .+ \(UTC\)/);
    expect(message.text).toContain(
      "If you did not start this session, change your password immediately.",
    );
    expect(message.text).not.toMatch(/http|reset|forgot/i);
    expect(message.html).toContain("change your password");
    expect(message.html).not.toMatch(/http/i);
  });

  it("deve escapar HTML no primeiro nome", () => {
    const message = buildNewSessionEmail(
      { ...user, firstName: "Ada <script>" },
      new Date("2026-11-09T15:42:00Z"),
    );

    expect(message.html).not.toContain("<script>");
    expect(message.html).toContain("Ada &lt;script&gt;");
  });
});
