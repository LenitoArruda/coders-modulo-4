import { describe, expect, it } from "vitest";

import { FakeOpaqueToken } from "../../../test/fakes/fake-opaque-token";
import { FakePasswordHasher } from "../../../test/fakes/fake-password-hasher";
import { InMemoryAuthTokensRepository } from "../../../test/fakes/in-memory-auth-tokens.repository";
import { InMemoryEmailSender } from "../../../test/fakes/in-memory-email.sender";
import {
  InMemorySessionsRepository,
  activeSession,
} from "../../../test/fakes/in-memory-sessions.repository";
import { InMemoryUsersRepository } from "../../../test/fakes/in-memory-users.repository";
import { InvalidResetTokenError } from "../domain/reset-password.errors";

import { ResetPasswordUseCase } from "./reset-password.use-case";

const WEB_ORIGIN = "http://localhost:3000";
const NEW_PASSWORD = "new correct horse battery staple";

function buildFixture() {
  const users = new InMemoryUsersRepository();
  const authTokens = new InMemoryAuthTokensRepository();
  const sessions = new InMemorySessionsRepository();
  const opaqueTokens = new FakeOpaqueToken();
  const hasher = new FakePasswordHasher();
  const emails = new InMemoryEmailSender();
  const useCase = new ResetPasswordUseCase(
    users,
    authTokens,
    sessions,
    opaqueTokens,
    hasher,
    emails,
    WEB_ORIGIN,
  );

  async function seedAccount(emailConfirmedAt: Date | null = new Date()) {
    return users.seed({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      emailConfirmedAt,
      passwordHash: await hasher.hash("old password"),
    });
  }

  async function issueToken(
    userId: string,
    overrides: {
      expiresAt?: Date;
      purpose?: "password_reset" | "email_confirmation";
    } = {},
  ): Promise<string> {
    const generated = opaqueTokens.generate();

    await authTokens.create({
      userId,
      purpose: overrides.purpose ?? "password_reset",
      tokenHash: generated.hash,
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 3_600_000),
    });

    return generated.token;
  }

  return {
    users,
    authTokens,
    sessions,
    hasher,
    emails,
    useCase,
    seedAccount,
    issueToken,
  };
}

describe("ResetPasswordUseCase", () => {
  it("deve trocar a senha, consumir o token, revogar sessões e enviar o e-mail", async () => {
    const f = buildFixture();
    const account = await f.seedAccount();
    const token = await f.issueToken(account.id);
    const otherToken = await f.issueToken(account.id);
    f.sessions.seed(activeSession(account.id, "sign_in"));
    f.sessions.seed(activeSession(account.id, "sign_up_confirmation"));

    await f.useCase.execute({ token, password: NEW_PASSWORD });

    const stored = await f.users.findAccountById(account.id);
    expect(stored?.passwordHash).toBe(`fake-hash:${NEW_PASSWORD}`);
    expect(stored?.passwordHash).not.toBe(NEW_PASSWORD);

    expect(f.authTokens.tokens.every((t) => t.usedAt !== null)).toBe(true);
    expect(otherToken).not.toBe(token);
    expect(f.sessions.sessions.every((s) => s.revokedAt !== null)).toBe(true);

    expect(f.emails.messages).toHaveLength(1);
    expect(f.emails.messages[0]?.to).toBe("ada@example.com");
    expect(f.emails.messages[0]?.subject).toBe(
      "Your password has been changed",
    );
    expect(f.emails.messages[0]?.text).not.toContain(NEW_PASSWORD);
    expect(f.emails.messages[0]?.text).not.toContain(token);
  });

  it("deve confirmar o e-mail de conta não confirmada e preservar a data de uma já confirmada", async () => {
    const f = buildFixture();
    const unconfirmed = await f.seedAccount(null);
    const token = await f.issueToken(unconfirmed.id);

    await f.useCase.execute({ token, password: NEW_PASSWORD });

    expect(
      (await f.users.findAccountById(unconfirmed.id))?.emailConfirmedAt,
    ).not.toBeNull();

    const f2 = buildFixture();
    const confirmedAt = new Date("2026-01-01T00:00:00.000Z");
    const confirmed = await f2.seedAccount(confirmedAt);
    const token2 = await f2.issueToken(confirmed.id);

    await f2.useCase.execute({ token: token2, password: NEW_PASSWORD });

    expect(
      (await f2.users.findAccountById(confirmed.id))?.emailConfirmedAt,
    ).toEqual(confirmedAt);
  });

  it("não deve afetar sessões de outra pessoa", async () => {
    const f = buildFixture();
    const account = await f.seedAccount();
    const stranger = f.users.seed({
      firstName: "Grace",
      lastName: "Hopper",
      email: "grace@example.com",
    });
    const token = await f.issueToken(account.id);
    const strangerSession = f.sessions.seed(activeSession(stranger.id));

    await f.useCase.execute({ token, password: NEW_PASSWORD });

    expect(strangerSession.revokedAt).toBeNull();
  });

  it.each([
    ["vazio", ""],
    ["desconhecido", "unknown-token"],
  ])("deve rejeitar token %s sem alterar nada", async (_label, token) => {
    const f = buildFixture();
    const account = await f.seedAccount();
    const session = f.sessions.seed(activeSession(account.id));

    await expect(
      f.useCase.execute({ token, password: NEW_PASSWORD }),
    ).rejects.toBeInstanceOf(InvalidResetTokenError);

    expect((await f.users.findAccountById(account.id))?.passwordHash).toBe(
      "fake-hash:old password",
    );
    expect(session.revokedAt).toBeNull();
    expect(f.emails.messages).toHaveLength(0);
  });

  it("deve rejeitar token expirado sem consumi-lo", async () => {
    const f = buildFixture();
    const account = await f.seedAccount();
    const token = await f.issueToken(account.id, {
      expiresAt: new Date(Date.now() - 1_000),
    });

    await expect(
      f.useCase.execute({ token, password: NEW_PASSWORD }),
    ).rejects.toBeInstanceOf(InvalidResetTokenError);

    expect(f.authTokens.tokens[0]?.usedAt).toBeNull();
    expect((await f.users.findAccountById(account.id))?.passwordHash).toBe(
      "fake-hash:old password",
    );
  });

  it("deve rejeitar token de confirmação de e-mail", async () => {
    const f = buildFixture();
    const account = await f.seedAccount();
    const token = await f.issueToken(account.id, {
      purpose: "email_confirmation",
    });

    await expect(
      f.useCase.execute({ token, password: NEW_PASSWORD }),
    ).rejects.toBeInstanceOf(InvalidResetTokenError);

    expect(f.authTokens.tokens[0]?.usedAt).toBeNull();
  });

  it("deve rejeitar o segundo uso do mesmo token sem trocar a senha de novo", async () => {
    const f = buildFixture();
    const account = await f.seedAccount();
    const token = await f.issueToken(account.id);

    await f.useCase.execute({ token, password: NEW_PASSWORD });

    await expect(
      f.useCase.execute({ token, password: "another password 123" }),
    ).rejects.toBeInstanceOf(InvalidResetTokenError);

    expect((await f.users.findAccountById(account.id))?.passwordHash).toBe(
      `fake-hash:${NEW_PASSWORD}`,
    );
    expect(f.emails.messages).toHaveLength(1);
  });

  it("deve deixar só um de dois resets simultâneos vencer", async () => {
    const f = buildFixture();
    const account = await f.seedAccount();
    const token = await f.issueToken(account.id);

    const results = await Promise.allSettled([
      f.useCase.execute({ token, password: "first password 123" }),
      f.useCase.execute({ token, password: "second password 123" }),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason).toBeInstanceOf(
      InvalidResetTokenError,
    );
    expect(f.emails.messages).toHaveLength(1);
  });

  it("deve manter a senha alterada quando o e-mail falha", async () => {
    const f = buildFixture();
    const account = await f.seedAccount();
    const token = await f.issueToken(account.id);
    const session = f.sessions.seed(activeSession(account.id));
    f.emails.failure = new Error("smtp connection refused");

    await expect(
      f.useCase.execute({ token, password: NEW_PASSWORD }),
    ).resolves.toBeUndefined();

    expect((await f.users.findAccountById(account.id))?.passwordHash).toBe(
      `fake-hash:${NEW_PASSWORD}`,
    );
    expect(session.revokedAt).not.toBeNull();
    expect(f.emails.messages).toHaveLength(0);
  });

  it("não deve consumir o token quando o hash da senha falha", async () => {
    const f = buildFixture();
    const account = await f.seedAccount();
    const token = await f.issueToken(account.id);

    f.hasher.hash = () => Promise.reject(new Error("hash failure"));

    await expect(
      f.useCase.execute({ token, password: NEW_PASSWORD }),
    ).rejects.toThrow("hash failure");

    expect(f.authTokens.tokens[0]?.usedAt).toBeNull();
  });
});
