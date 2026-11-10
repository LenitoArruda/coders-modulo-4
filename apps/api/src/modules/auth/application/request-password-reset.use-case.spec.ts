import { describe, expect, it } from "vitest";

import { FakeOpaqueToken } from "../../../test/fakes/fake-opaque-token";
import { InMemoryAuthTokensRepository } from "../../../test/fakes/in-memory-auth-tokens.repository";
import { InMemoryEmailSender } from "../../../test/fakes/in-memory-email.sender";
import { InMemoryUsersRepository } from "../../../test/fakes/in-memory-users.repository";

import { RequestPasswordResetUseCase } from "./request-password-reset.use-case";

const WEB_ORIGIN = "http://localhost:3000";
const TTL_SECONDS = 3_600;

function buildFixture() {
  const users = new InMemoryUsersRepository();
  const authTokens = new InMemoryAuthTokensRepository();
  const opaqueTokens = new FakeOpaqueToken();
  const emails = new InMemoryEmailSender();
  const useCase = new RequestPasswordResetUseCase(
    users,
    authTokens,
    opaqueTokens,
    emails,
    TTL_SECONDS,
    WEB_ORIGIN,
  );

  return { users, authTokens, opaqueTokens, emails, useCase };
}

function extractToken(text: string): string {
  const match = /token=(\S+)/.exec(text);

  if (match?.[1] === undefined) {
    throw new Error("Reset token not found in the email");
  }

  return match[1];
}

describe("RequestPasswordResetUseCase", () => {
  it("deve emitir token de reset e enviar e-mail para conta confirmada", async () => {
    const { users, authTokens, opaqueTokens, emails, useCase } = buildFixture();
    const account = users.seed({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      emailConfirmedAt: new Date(),
    });

    const before = Date.now();

    await useCase.execute({ email: " ADA@Example.com " });

    expect(authTokens.tokens).toHaveLength(1);
    const stored = authTokens.tokens[0];
    expect(stored?.userId).toBe(account.id);
    expect(stored?.purpose).toBe("password_reset");
    expect(stored?.usedAt).toBeNull();
    expect(stored?.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + TTL_SECONDS * 1000,
    );
    expect(stored?.expiresAt.getTime()).toBeLessThanOrEqual(
      Date.now() + TTL_SECONDS * 1000,
    );

    const message = emails.messages[0];
    expect(message?.to).toBe("ada@example.com");
    expect(message?.subject).toBe("Reset your password");

    const clearToken = extractToken(message?.text ?? "");
    expect(stored?.tokenHash).toBe(opaqueTokens.hash(clearToken));
    expect(stored?.tokenHash).not.toBe(clearToken);
    expect(message?.text).toContain(
      `${WEB_ORIGIN}/auth/reset-password?token=${clearToken}`,
    );
  });

  it("deve enviar recuperação também para conta não confirmada", async () => {
    const { users, authTokens, emails, useCase } = buildFixture();
    users.seed({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      emailConfirmedAt: null,
    });

    await useCase.execute({ email: "ada@example.com" });

    expect(authTokens.tokens).toHaveLength(1);
    expect(emails.messages).toHaveLength(1);
  });

  it("não deve criar token nem enviar e-mail para conta inexistente", async () => {
    const { authTokens, emails, useCase } = buildFixture();

    await expect(
      useCase.execute({ email: "nobody@example.com" }),
    ).resolves.toBeUndefined();

    expect(authTokens.tokens).toHaveLength(0);
    expect(emails.messages).toHaveLength(0);
  });

  it("deve manter a resposta estável quando o envio do e-mail falha", async () => {
    const { users, authTokens, emails, useCase } = buildFixture();
    users.seed({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
    });
    emails.failure = new Error("smtp unavailable");

    await expect(
      useCase.execute({ email: "ada@example.com" }),
    ).resolves.toBeUndefined();

    expect(authTokens.tokens).toHaveLength(1);
    expect(authTokens.tokens[0]?.usedAt).toBeNull();
  });

  it("deve invalidar o token anterior ao emitir um novo", async () => {
    const { users, authTokens, emails, useCase } = buildFixture();
    users.seed({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
    });

    await useCase.execute({ email: "ada@example.com" });
    await useCase.execute({ email: "ada@example.com" });

    expect(authTokens.tokens).toHaveLength(2);
    expect(authTokens.tokens[0]?.usedAt).not.toBeNull();
    expect(authTokens.tokens[1]?.usedAt).toBeNull();
    expect(extractToken(emails.messages[0]?.text ?? "")).not.toBe(
      extractToken(emails.messages[1]?.text ?? ""),
    );
  });

  it("não deve deixar dois tokens válidos sob pedidos simultâneos", async () => {
    const { users, authTokens, useCase } = buildFixture();
    users.seed({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
    });

    await Promise.all([
      useCase.execute({ email: "ada@example.com" }),
      useCase.execute({ email: "ada@example.com" }),
    ]);

    const unused = authTokens.tokens.filter((token) => token.usedAt === null);

    expect(authTokens.tokens).toHaveLength(2);
    expect(unused.length).toBeLessThanOrEqual(1);
  });
});
