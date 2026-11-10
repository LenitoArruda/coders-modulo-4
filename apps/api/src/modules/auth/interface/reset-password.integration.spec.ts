import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AppModule } from "../../../app.module";
import { configureApp } from "../../../app-setup";
import { FakeOpaqueToken } from "../../../test/fakes/fake-opaque-token";
import { FakePasswordHasher } from "../../../test/fakes/fake-password-hasher";
import { InMemoryAuthTokensRepository } from "../../../test/fakes/in-memory-auth-tokens.repository";
import { InMemoryEmailSender } from "../../../test/fakes/in-memory-email.sender";
import { InMemorySessionsRepository } from "../../../test/fakes/in-memory-sessions.repository";
import { InMemoryUsersRepository } from "../../../test/fakes/in-memory-users.repository";
import { AuthTokensRepositoryPort } from "../application/ports/auth-tokens-repository.port";
import { EmailSenderPort } from "../application/ports/email-sender.port";
import { OpaqueTokenPort } from "../application/ports/opaque-token.port";
import { PasswordHasherPort } from "../application/ports/password-hasher.port";
import { SessionsRepositoryPort } from "../application/ports/sessions-repository.port";
import { UsersRepositoryPort } from "../application/ports/users-repository.port";

import { ResetPasswordRateLimiter } from "./reset-password-rate-limiter";
import { SignInRateLimiter } from "./sign-in-rate-limiter";

const RATE_LIMIT_MAX = 5;
const RESET_PATH = "/api/v1/auth/reset-password";
const OLD_PASSWORD = "old correct horse battery";
const NEW_PASSWORD = "new correct horse battery staple";

const successBody = {
  message: "Your password has been updated. Sign in with your new password.",
};
const invalidTokenBody = {
  code: "INVALID_RESET_TOKEN",
  message: "This password reset link is invalid or has expired.",
};

describe("POST /api/v1/auth/reset-password", () => {
  let app: INestApplication;
  let users: InMemoryUsersRepository;
  let authTokens: InMemoryAuthTokensRepository;
  let sessions: InMemorySessionsRepository;
  let emails: InMemoryEmailSender;
  let opaqueTokens: FakeOpaqueToken;
  let limiter: ResetPasswordRateLimiter;
  let signInLimiter: SignInRateLimiter;
  const hasher = new FakePasswordHasher();

  beforeAll(async () => {
    users = new InMemoryUsersRepository();
    authTokens = new InMemoryAuthTokensRepository();
    sessions = new InMemorySessionsRepository();
    emails = new InMemoryEmailSender();
    opaqueTokens = new FakeOpaqueToken();
    limiter = new ResetPasswordRateLimiter(RATE_LIMIT_MAX, 60);
    signInLimiter = new SignInRateLimiter(100, 60);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(UsersRepositoryPort)
      .useValue(users)
      .overrideProvider(AuthTokensRepositoryPort)
      .useValue(authTokens)
      .overrideProvider(SessionsRepositoryPort)
      .useValue(sessions)
      .overrideProvider(EmailSenderPort)
      .useValue(emails)
      .overrideProvider(OpaqueTokenPort)
      .useValue(opaqueTokens)
      .overrideProvider(PasswordHasherPort)
      .useValue(hasher)
      .overrideProvider(ResetPasswordRateLimiter)
      .useValue(limiter)
      .overrideProvider(SignInRateLimiter)
      .useValue(signInLimiter)
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
  });

  beforeEach(() => {
    users.users.length = 0;
    authTokens.tokens.length = 0;
    sessions.sessions.length = 0;
    emails.messages.length = 0;
    emails.failure = null;
    limiter.reset();
    signInLimiter.reset();
  });

  afterAll(async () => {
    await app.close();
  });

  async function seedAccount(emailConfirmedAt: Date | null = new Date()) {
    return users.seed({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      emailConfirmedAt,
      passwordHash: await hasher.hash(OLD_PASSWORD),
    });
  }

  async function issueToken(
    userId: string,
    expiresAt = new Date(Date.now() + 3_600_000),
  ): Promise<string> {
    const generated = opaqueTokens.generate();

    await authTokens.create({
      userId,
      purpose: "password_reset",
      tokenHash: generated.hash,
      expiresAt,
    });

    return generated.token;
  }

  function reset(body: Record<string, unknown>) {
    return request(app.getHttpServer()).post(RESET_PATH).send(body);
  }

  function signIn(email: string, password: string) {
    return request(app.getHttpServer())
      .post("/api/v1/auth/sign-in")
      .send({ email, password });
  }

  it("deve trocar a senha, consumir o token, revogar sessões e enviar o e-mail", async () => {
    const account = await seedAccount();
    const token = await issueToken(account.id);

    const oldSession = await signIn("ada@example.com", OLD_PASSWORD).expect(
      200,
    );
    const oldJwt = (oldSession.body as { accessToken: string }).accessToken;

    await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${oldJwt}`)
      .expect(200);

    emails.messages.length = 0;

    const response = await reset({
      token,
      password: NEW_PASSWORD,
      passwordConfirmation: NEW_PASSWORD,
    }).expect(200);

    expect(response.body).toEqual(successBody);
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(response.text).not.toContain(token);
    expect(response.text).not.toContain(NEW_PASSWORD);

    expect(authTokens.tokens.every((t) => t.usedAt !== null)).toBe(true);
    expect(sessions.sessions.every((s) => s.revokedAt !== null)).toBe(true);

    // The old JWT still has a valid signature but its session was revoked.
    await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${oldJwt}`)
      .expect(401);

    await signIn("ada@example.com", OLD_PASSWORD).expect(401);
    await signIn("ada@example.com", NEW_PASSWORD).expect(200);

    const message = emails.messages.find(
      (m) => m.subject === "Your password has been changed",
    );
    expect(message?.to).toBe("ada@example.com");
    expect(message?.text).toContain(
      "http://localhost:3000/auth/forgot-password",
    );
    expect(message?.text).not.toContain(token);
    expect(message?.text).not.toContain(NEW_PASSWORD);
  });

  it("deve confirmar o e-mail de uma conta não confirmada", async () => {
    const account = await seedAccount(null);
    const token = await issueToken(account.id);

    await reset({
      token,
      password: NEW_PASSWORD,
      passwordConfirmation: NEW_PASSWORD,
    }).expect(200);

    expect(
      (await users.findAccountById(account.id))?.emailConfirmedAt,
    ).not.toBeNull();
    await signIn("ada@example.com", NEW_PASSWORD).expect(200);
  });

  it("deve manter a senha alterada quando o e-mail de sucesso falha", async () => {
    const account = await seedAccount();
    const token = await issueToken(account.id);
    emails.failure = new Error("smtp connection refused");

    const response = await reset({
      token,
      password: NEW_PASSWORD,
      passwordConfirmation: NEW_PASSWORD,
    }).expect(200);

    expect(response.body).toEqual(successBody);
    expect((await users.findAccountById(account.id))?.passwordHash).toBe(
      `fake-hash:${NEW_PASSWORD}`,
    );
  });

  it.each([
    ["ausente", undefined],
    ["desconhecido", "unknown-token"],
  ])(
    "deve responder INVALID_RESET_TOKEN para token %s",
    async (_label, token) => {
      const account = await seedAccount();

      const response = await reset({
        ...(token === undefined ? {} : { token }),
        password: NEW_PASSWORD,
        passwordConfirmation: NEW_PASSWORD,
      }).expect(400);

      expect(response.body).toEqual(invalidTokenBody);
      expect((await users.findAccountById(account.id))?.passwordHash).toBe(
        `fake-hash:${OLD_PASSWORD}`,
      );
      expect(sessions.sessions).toHaveLength(0);
      expect(emails.messages).toHaveLength(0);
    },
  );

  it("deve responder INVALID_RESET_TOKEN para token expirado", async () => {
    const account = await seedAccount();
    const token = await issueToken(account.id, new Date(Date.now() - 1_000));

    const response = await reset({
      token,
      password: NEW_PASSWORD,
      passwordConfirmation: NEW_PASSWORD,
    }).expect(400);

    expect(response.body).toEqual(invalidTokenBody);
    expect(authTokens.tokens[0]?.usedAt).toBeNull();
  });

  it("deve rejeitar o segundo uso do mesmo token sem trocar a senha de novo", async () => {
    const account = await seedAccount();
    const token = await issueToken(account.id);

    await reset({
      token,
      password: NEW_PASSWORD,
      passwordConfirmation: NEW_PASSWORD,
    }).expect(200);

    const second = await reset({
      token,
      password: "another password 123",
      passwordConfirmation: "another password 123",
    }).expect(400);

    expect(second.body).toEqual(invalidTokenBody);
    expect((await users.findAccountById(account.id))?.passwordHash).toBe(
      `fake-hash:${NEW_PASSWORD}`,
    );
  });

  it("deve deixar só um de dois resets simultâneos com o mesmo token vencer", async () => {
    const account = await seedAccount();
    const token = await issueToken(account.id);

    const [first, second] = await Promise.all([
      reset({
        token,
        password: "first password 123",
        passwordConfirmation: "first password 123",
      }),
      reset({
        token,
        password: "second password 123",
        passwordConfirmation: "second password 123",
      }),
    ]);

    expect([first.status, second.status].sort()).toEqual([200, 400]);
    expect(emails.messages).toHaveLength(1);
  });

  it("deve responder 400 com erros por campo e não queimar o token", async () => {
    const account = await seedAccount();
    const token = await issueToken(account.id);

    const weak = await reset({
      token,
      password: "short",
      passwordConfirmation: "short",
    }).expect(400);

    expect(weak.body).toEqual({
      code: "VALIDATION_ERROR",
      message: "Check the highlighted fields and try again.",
      // Same as sign-up: a password that fails its own check never matches.
      fieldErrors: {
        password: "Password must be at least 8 characters.",
        passwordConfirmation: "Passwords do not match.",
      },
    });

    const mismatch = await reset({
      token,
      password: NEW_PASSWORD,
      passwordConfirmation: "different password",
    }).expect(400);

    expect(mismatch.body).toEqual({
      code: "VALIDATION_ERROR",
      message: "Check the highlighted fields and try again.",
      fieldErrors: { passwordConfirmation: "Passwords do not match." },
    });

    expect(authTokens.tokens[0]?.usedAt).toBeNull();
    expect((await users.findAccountById(account.id))?.passwordHash).toBe(
      `fake-hash:${OLD_PASSWORD}`,
    );

    await reset({
      token,
      password: NEW_PASSWORD,
      passwordConfirmation: NEW_PASSWORD,
    }).expect(200);
  });

  it("deve preferir VALIDATION_ERROR quando token e senha são inválidos", async () => {
    await seedAccount();

    const response = await reset({
      token: "unknown-token",
      password: "short",
      passwordConfirmation: "short",
    }).expect(400);

    expect(response.body).toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("deve responder 429 com Retry-After na 6ª tentativa por IP", async () => {
    for (let attempt = 0; attempt < RATE_LIMIT_MAX; attempt += 1) {
      await reset({
        token: "unknown-token",
        password: NEW_PASSWORD,
        passwordConfirmation: NEW_PASSWORD,
      }).expect(400);
    }

    const response = await reset({
      token: "unknown-token",
      password: NEW_PASSWORD,
      passwordConfirmation: NEW_PASSWORD,
    }).expect(429);

    expect(response.body).toEqual({
      code: "TOO_MANY_REQUESTS",
      message: "Too many attempts. Wait a moment and try again.",
    });
    expect(Number(response.headers["retry-after"])).toBeGreaterThan(0);
    expect(response.text).not.toMatch(/stack|postgres/i);
  });
});
