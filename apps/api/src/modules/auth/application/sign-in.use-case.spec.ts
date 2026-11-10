import { describe, expect, it, vi } from "vitest";

import { FakePasswordHasher } from "../../../test/fakes/fake-password-hasher";
import { FakeSessionToken } from "../../../test/fakes/fake-session-token";
import { InMemoryEmailSender } from "../../../test/fakes/in-memory-email.sender";
import { InMemorySessionsRepository } from "../../../test/fakes/in-memory-sessions.repository";
import { InMemoryUsersRepository } from "../../../test/fakes/in-memory-users.repository";
import {
  EmailNotConfirmedError,
  InvalidCredentialsError,
} from "../domain/sign-in.errors";

import { CreateSessionUseCase } from "./create-session.use-case";
import { SignInUseCase } from "./sign-in.use-case";

const SESSION_TTL_SECONDS = 3600;
const PASSWORD = "correct horse battery staple";

function setup() {
  const users = new InMemoryUsersRepository();
  const hasher = new FakePasswordHasher();
  const sessions = new InMemorySessionsRepository();
  const emails = new InMemoryEmailSender();
  const createSession = new CreateSessionUseCase(
    sessions,
    new FakeSessionToken(),
    emails,
    SESSION_TTL_SECONDS,
    "http://localhost:3000",
  );
  const useCase = new SignInUseCase(
    users,
    hasher,
    createSession,
    SESSION_TTL_SECONDS,
  );

  return { useCase, users, hasher, sessions, emails };
}

async function seedAccount(
  users: InMemoryUsersRepository,
  hasher: FakePasswordHasher,
  emailConfirmedAt: Date | null = new Date("2026-11-09T12:00:00.000Z"),
) {
  return users.seed({
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    emailConfirmedAt,
    passwordHash: await hasher.hash(PASSWORD),
  });
}

describe("SignInUseCase", () => {
  it("deve criar sessão sign_in, devolver o token e enviar o e-mail", async () => {
    const { useCase, users, hasher, sessions, emails } = setup();
    const account = await seedAccount(users, hasher);

    const result = await useCase.execute({
      email: "ada@example.com",
      password: PASSWORD,
    });

    expect(result).toMatchObject({
      tokenType: "Bearer",
      expiresIn: SESSION_TTL_SECONDS,
      user: {
        id: account.id,
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
      },
    });
    expect(result.accessToken.length).toBeGreaterThan(0);
    expect(JSON.stringify(result)).not.toContain("hash");
    expect(sessions.sessions).toHaveLength(1);
    expect(sessions.sessions[0]).toMatchObject({
      userId: account.id,
      origin: "sign_in",
      revokedAt: null,
    });
    expect(emails.messages).toHaveLength(1);
    expect(emails.messages[0]?.subject).toBe("New session on your account");
    expect(emails.messages[0]?.to).toBe("ada@example.com");
  });

  it("deve revogar as sessões anteriores e manter só a nova ativa", async () => {
    const { useCase, users, hasher, sessions } = setup();
    const account = await seedAccount(users, hasher);
    const previous = sessions.seed({
      userId: account.id,
      origin: "sign_up_confirmation",
      createdAt: new Date(Date.now() - 60_000),
      expiresAt: new Date(Date.now() + 3_600_000),
      revokedAt: null,
    });

    await useCase.execute({ email: "ada@example.com", password: PASSWORD });

    expect(previous.revokedAt).not.toBeNull();
    expect(
      sessions.sessions.filter((session) => session.revokedAt === null),
    ).toHaveLength(1);
  });

  it("deve manter no máximo uma sessão ativa sob sign-ins simultâneos", async () => {
    const { useCase, users, hasher, sessions } = setup();

    await seedAccount(users, hasher);
    await Promise.all([
      useCase.execute({ email: "ada@example.com", password: PASSWORD }),
      useCase.execute({ email: "ada@example.com", password: PASSWORD }),
      useCase.execute({ email: "ada@example.com", password: PASSWORD }),
    ]);

    expect(
      sessions.sessions.filter((session) => session.revokedAt === null).length,
    ).toBeLessThanOrEqual(1);
  });

  it("deve rejeitar senha incorreta sem criar sessão nem e-mail", async () => {
    const { useCase, users, hasher, sessions, emails } = setup();

    await seedAccount(users, hasher);

    await expect(
      useCase.execute({ email: "ada@example.com", password: "wrong" }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(sessions.sessions).toHaveLength(0);
    expect(emails.messages).toHaveLength(0);
  });

  it("deve rejeitar e-mail inexistente com o mesmo erro e ainda verificar uma senha", async () => {
    const { useCase, hasher, sessions, emails } = setup();
    const verify = vi.spyOn(hasher, "verify");

    await expect(
      useCase.execute({ email: "ghost@example.com", password: PASSWORD }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(verify).toHaveBeenCalledTimes(1);
    expect(sessions.sessions).toHaveLength(0);
    expect(emails.messages).toHaveLength(0);
  });

  it("deve calcular o hash dummy uma única vez", async () => {
    const { useCase, hasher } = setup();
    const hash = vi.spyOn(hasher, "hash");

    for (const email of ["a@example.com", "b@example.com"]) {
      await expect(
        useCase.execute({ email, password: PASSWORD }),
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
    }

    expect(hash).toHaveBeenCalledTimes(1);
  });

  it("deve responder não confirmada apenas com a senha correta", async () => {
    const { useCase, users, hasher, sessions, emails } = setup();

    await seedAccount(users, hasher, null);

    await expect(
      useCase.execute({ email: "ada@example.com", password: PASSWORD }),
    ).rejects.toBeInstanceOf(EmailNotConfirmedError);
    expect(sessions.sessions).toHaveLength(0);
    expect(emails.messages).toHaveLength(0);
  });

  it("deve tratar conta não confirmada com senha errada como credencial inválida", async () => {
    const { useCase, users, hasher } = setup();

    await seedAccount(users, hasher, null);

    await expect(
      useCase.execute({ email: "ada@example.com", password: "wrong" }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it("deve manter a sessão válida quando o e-mail de nova sessão falha", async () => {
    const { useCase, users, hasher, sessions, emails } = setup();

    await seedAccount(users, hasher);
    emails.failure = new Error("smtp down for ada@example.com");

    const result = await useCase.execute({
      email: "ada@example.com",
      password: PASSWORD,
    });

    expect(result.accessToken.length).toBeGreaterThan(0);
    expect(sessions.sessions).toHaveLength(1);
    expect(sessions.sessions[0]?.revokedAt).toBeNull();
  });
});
