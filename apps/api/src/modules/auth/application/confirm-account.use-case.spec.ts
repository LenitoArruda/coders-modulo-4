import { describe, expect, it } from "vitest";

import { FakeOpaqueToken } from "../../../test/fakes/fake-opaque-token";
import { FakeSessionToken } from "../../../test/fakes/fake-session-token";
import { InMemoryAuthTokensRepository } from "../../../test/fakes/in-memory-auth-tokens.repository";
import { InMemoryEmailSender } from "../../../test/fakes/in-memory-email.sender";
import { InMemorySessionsRepository } from "../../../test/fakes/in-memory-sessions.repository";
import { InMemoryUsersRepository } from "../../../test/fakes/in-memory-users.repository";
import {
  AccountAlreadyConfirmedError,
  InvalidConfirmationTokenError,
} from "../domain/confirmation.errors";

import { ConfirmAccountUseCase } from "./confirm-account.use-case";
import { CreateSessionUseCase } from "./create-session.use-case";

const SESSION_TTL_SECONDS = 604_800;
const WEB_ORIGIN = "http://localhost:3000";

function setup() {
  const users = new InMemoryUsersRepository();
  const authTokens = new InMemoryAuthTokensRepository();
  const emails = new InMemoryEmailSender();
  const opaqueTokens = new FakeOpaqueToken();
  const sessions = new InMemorySessionsRepository();
  const sessionTokens = new FakeSessionToken();
  const createSession = new CreateSessionUseCase(
    sessions,
    sessionTokens,
    emails,
    3600,
    WEB_ORIGIN,
  );
  const useCase = new ConfirmAccountUseCase(
    users,
    authTokens,
    opaqueTokens,
    createSession,
    SESSION_TTL_SECONDS,
  );

  return {
    useCase,
    users,
    authTokens,
    emails,
    opaqueTokens,
    sessions,
    sessionTokens,
  };
}

function seedAccount(
  users: InMemoryUsersRepository,
  overrides: { emailConfirmedAt?: Date | null } = {},
) {
  return users.seed({
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    ...overrides,
  });
}

async function seedToken(
  authTokens: InMemoryAuthTokensRepository,
  opaqueTokens: FakeOpaqueToken,
  userId: string,
  options: {
    purpose?: "email_confirmation" | "password_reset";
    expiresAt?: Date;
  } = {},
) {
  const generated = opaqueTokens.generate();

  await authTokens.create({
    userId,
    purpose: options.purpose ?? "email_confirmation",
    tokenHash: generated.hash,
    expiresAt: options.expiresAt ?? new Date(Date.now() + 86_400_000),
  });

  return generated.token;
}

describe("ConfirmAccountUseCase", () => {
  it("deve confirmar a conta, consumir o token e criar a sessão", async () => {
    const { useCase, users, authTokens, emails, opaqueTokens, sessions } =
      setup();
    const account = seedAccount(users);
    const token = await seedToken(authTokens, opaqueTokens, account.id);

    const result = await useCase.execute(token);

    expect(result).toEqual({
      accessToken: expect.stringContaining("fake-token"),
      tokenType: "Bearer",
      expiresIn: SESSION_TTL_SECONDS,
      user: {
        id: account.id,
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
      },
    });
    expect(account.emailConfirmedAt).not.toBeNull();
    expect(authTokens.tokens[0]?.usedAt).not.toBeNull();
    expect(sessions.sessions).toHaveLength(1);
    expect(sessions.sessions[0]).toMatchObject({
      userId: account.id,
      origin: "sign_up_confirmation",
      revokedAt: null,
    });
    expect(emails.messages).toHaveLength(1);
    expect(emails.messages[0]?.subject).toBe("New session on your account");
    expect(JSON.stringify(result)).not.toContain(token);
  });

  it("deve revogar a sessão ativa anterior ao confirmar", async () => {
    const { useCase, users, authTokens, opaqueTokens, sessions } = setup();
    const account = seedAccount(users);
    const previous = sessions.seed({
      userId: account.id,
      origin: "sign_in",
      createdAt: new Date(Date.now() - 60_000),
      expiresAt: new Date(Date.now() + 3_600_000),
      revokedAt: null,
    });
    const token = await seedToken(authTokens, opaqueTokens, account.id);

    await useCase.execute(token);

    expect(previous.revokedAt).not.toBeNull();

    const active = await Promise.all(
      sessions.sessions.map((candidate) =>
        sessions.findActiveById(candidate.id),
      ),
    );

    expect(active.filter((candidate) => candidate !== null)).toHaveLength(1);
  });

  it("deve rejeitar token vazio ou ausente", async () => {
    const { useCase } = setup();

    await expect(useCase.execute("")).rejects.toBeInstanceOf(
      InvalidConfirmationTokenError,
    );
    await expect(useCase.execute("   ")).rejects.toBeInstanceOf(
      InvalidConfirmationTokenError,
    );
  });

  it("deve rejeitar token desconhecido", async () => {
    const { useCase, users } = setup();
    seedAccount(users);

    await expect(useCase.execute("unknown-token")).rejects.toBeInstanceOf(
      InvalidConfirmationTokenError,
    );
  });

  it("deve rejeitar token de outro purpose", async () => {
    const { useCase, users, authTokens, opaqueTokens } = setup();
    const account = seedAccount(users);
    const token = await seedToken(authTokens, opaqueTokens, account.id, {
      purpose: "password_reset",
    });

    await expect(useCase.execute(token)).rejects.toBeInstanceOf(
      InvalidConfirmationTokenError,
    );
    expect(account.emailConfirmedAt).toBeNull();
  });

  it("deve rejeitar token expirado sem confirmar a conta", async () => {
    const { useCase, users, authTokens, opaqueTokens, sessions } = setup();
    const account = seedAccount(users);
    const token = await seedToken(authTokens, opaqueTokens, account.id, {
      expiresAt: new Date(Date.now() - 1_000),
    });

    await expect(useCase.execute(token)).rejects.toBeInstanceOf(
      InvalidConfirmationTokenError,
    );
    expect(account.emailConfirmedAt).toBeNull();
    expect(sessions.sessions).toHaveLength(0);
  });

  it("deve rejeitar token já usado quando a conta não foi confirmada", async () => {
    const { useCase, users, authTokens, opaqueTokens } = setup();
    const account = seedAccount(users);
    const token = await seedToken(authTokens, opaqueTokens, account.id);

    authTokens.tokens[0]!.usedAt = new Date();

    await expect(useCase.execute(token)).rejects.toBeInstanceOf(
      InvalidConfirmationTokenError,
    );
  });

  it("deve sinalizar conflito para conta já confirmada sem criar sessão", async () => {
    const { useCase, users, authTokens, emails, opaqueTokens, sessions } =
      setup();
    const account = seedAccount(users, { emailConfirmedAt: new Date() });
    const token = await seedToken(authTokens, opaqueTokens, account.id);

    await expect(useCase.execute(token)).rejects.toBeInstanceOf(
      AccountAlreadyConfirmedError,
    );
    expect(sessions.sessions).toHaveLength(0);
    expect(emails.messages).toHaveLength(0);
  });

  it("deve sinalizar conflito quando outra requisição consome o token primeiro", async () => {
    const { useCase, users, authTokens, opaqueTokens, sessions } = setup();
    const account = seedAccount(users);
    const token = await seedToken(authTokens, opaqueTokens, account.id);
    const originalConsume = authTokens.consume.bind(authTokens);

    authTokens.consume = async (tokenId: string) => {
      await originalConsume(tokenId);

      return false;
    };

    await expect(useCase.execute(token)).rejects.toBeInstanceOf(
      InvalidConfirmationTokenError,
    );
    expect(sessions.sessions).toHaveLength(0);
  });

  it("deve manter a sessão válida quando o e-mail de nova sessão falha", async () => {
    const { useCase, users, authTokens, emails, opaqueTokens, sessions } =
      setup();
    const account = seedAccount(users);
    const token = await seedToken(authTokens, opaqueTokens, account.id);
    emails.failure = new Error("smtp connection refused");

    const result = await useCase.execute(token);
    const active = await sessions.findActiveById(sessions.sessions[0]!.id);

    expect(active).not.toBeNull();
    expect(result.accessToken).toContain(active?.id ?? "missing");
  });
});
