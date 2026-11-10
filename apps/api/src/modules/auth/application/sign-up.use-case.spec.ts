import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeOpaqueToken } from "../../../test/fakes/fake-opaque-token";
import { FakePasswordHasher } from "../../../test/fakes/fake-password-hasher";
import { InMemoryAuthTokensRepository } from "../../../test/fakes/in-memory-auth-tokens.repository";
import { InMemoryEmailSender } from "../../../test/fakes/in-memory-email.sender";
import { InMemoryUsersRepository } from "../../../test/fakes/in-memory-users.repository";
import { type SignUpInput } from "../domain/sign-up-input";
import {
  ConfirmationEmailDeliveryError,
  DuplicateEmailError,
  EmailAlreadyConfirmedError,
} from "../domain/sign-up.errors";

import { SignUpUseCase } from "./sign-up.use-case";

const WEB_ORIGIN = "http://localhost:3000";
const TOKEN_TTL_SECONDS = 86_400;

const input: SignUpInput = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  password: "correct horse battery staple",
  passwordConfirmation: "correct horse battery staple",
};

function extractToken(text: string): string {
  const match = /token=(\S+)/.exec(text);

  if (match?.[1] === undefined) {
    throw new Error("Confirmation token not found in the email");
  }

  return match[1];
}

describe("SignUpUseCase", () => {
  let users: InMemoryUsersRepository;
  let authTokens: InMemoryAuthTokensRepository;
  let passwordHasher: FakePasswordHasher;
  let opaqueTokens: FakeOpaqueToken;
  let emails: InMemoryEmailSender;
  let useCase: SignUpUseCase;

  beforeEach(() => {
    users = new InMemoryUsersRepository();
    authTokens = new InMemoryAuthTokensRepository();
    passwordHasher = new FakePasswordHasher();
    opaqueTokens = new FakeOpaqueToken();
    emails = new InMemoryEmailSender();
    useCase = new SignUpUseCase(
      users,
      authTokens,
      passwordHasher,
      opaqueTokens,
      emails,
      TOKEN_TTL_SECONDS,
      WEB_ORIGIN,
    );
  });

  it("deve criar conta não confirmada, persistir hash e enviar o link", async () => {
    const result = await useCase.execute(input);

    expect(result.created).toBe(true);
    expect(result.user).toEqual({
      id: expect.any(String),
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
    });
    expect(users.users).toHaveLength(1);
    expect(users.users[0]?.emailConfirmedAt).toBeNull();
    expect(users.users[0]?.passwordHash).toBe(`fake-hash:${input.password}`);

    expect(authTokens.tokens).toHaveLength(1);
    const storedToken = authTokens.tokens[0];
    expect(storedToken?.purpose).toBe("email_confirmation");
    expect(storedToken?.usedAt).toBeNull();
    expect(storedToken?.expiresAt.getTime()).toBeGreaterThan(
      Date.now() + TOKEN_TTL_SECONDS * 1000 - 5_000,
    );

    expect(emails.messages).toHaveLength(1);
    const message = emails.messages[0];
    expect(message?.to).toBe("ada@example.com");
    expect(message?.subject).toBe("Confirm your account");

    const clearToken = extractToken(message?.text ?? "");
    expect(storedToken?.tokenHash).toBe(opaqueTokens.hash(clearToken));
    expect(storedToken?.tokenHash).not.toBe(clearToken);
    expect(message?.text).toContain(
      `${WEB_ORIGIN}/auth/confirm?token=${clearToken}`,
    );
  });

  it("deve recusar e-mail já confirmado sem duplicar a conta", async () => {
    const account = users.seed({ ...input, emailConfirmedAt: new Date() });

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      EmailAlreadyConfirmedError,
    );

    expect(users.users).toHaveLength(1);
    expect(users.users[0]?.id).toBe(account.id);
    expect(authTokens.tokens).toHaveLength(0);
    expect(emails.messages).toHaveLength(0);
  });

  it("deve reenviar a confirmação para e-mail não confirmado e invalidar o token anterior", async () => {
    await useCase.execute(input);
    const firstToken = authTokens.tokens[0];

    const result = await useCase.execute(input);

    expect(result.created).toBe(false);
    expect(users.users).toHaveLength(1);
    expect(authTokens.tokens).toHaveLength(2);
    expect(firstToken?.usedAt).not.toBeNull();
    expect(authTokens.tokens[1]?.usedAt).toBeNull();
    expect(authTokens.tokens[1]?.tokenHash).not.toBe(firstToken?.tokenHash);
    expect(emails.messages).toHaveLength(2);
    expect(extractToken(emails.messages[0]?.text ?? "")).not.toBe(
      extractToken(emails.messages[1]?.text ?? ""),
    );
  });

  it("deve reutilizar a conta não confirmada quando a criação perde a corrida de e-mail", async () => {
    users.seed(input);
    vi.spyOn(users, "findByEmail").mockResolvedValueOnce(null);
    vi.spyOn(users, "create").mockRejectedValueOnce(new DuplicateEmailError());

    const result = await useCase.execute(input);

    expect(result.created).toBe(false);
    expect(users.users).toHaveLength(1);
    expect(authTokens.tokens).toHaveLength(1);
    expect(emails.messages).toHaveLength(1);
  });

  it("deve propagar falha de e-mail como erro de entrega mantendo a conta reutilizável", async () => {
    emails.failure = new Error("smtp connection refused");

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      ConfirmationEmailDeliveryError,
    );

    expect(users.users).toHaveLength(1);
    expect(users.users[0]?.emailConfirmedAt).toBeNull();
    expect(authTokens.tokens).toHaveLength(1);
    expect(authTokens.tokens[0]?.usedAt).toBeNull();
    expect(emails.messages).toHaveLength(0);

    emails.failure = null;

    const retry = await useCase.execute(input);

    expect(retry.created).toBe(false);
    expect(users.users).toHaveLength(1);
    expect(authTokens.tokens).toHaveLength(2);
    expect(authTokens.tokens[0]?.usedAt).not.toBeNull();
    expect(emails.messages).toHaveLength(1);
  });

  it("não deve retornar senha, hash ou token no resultado", async () => {
    const result = await useCase.execute(input);
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain(input.password);
    expect(serialized).not.toContain("fake-hash");
    expect(serialized).not.toContain("clear-token");
  });
});
