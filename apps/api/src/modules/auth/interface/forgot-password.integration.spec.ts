import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { AppModule } from "../../../app.module";
import { configureApp } from "../../../app-setup";
import { FakeOpaqueToken } from "../../../test/fakes/fake-opaque-token";
import { InMemoryAuthTokensRepository } from "../../../test/fakes/in-memory-auth-tokens.repository";
import { InMemoryEmailSender } from "../../../test/fakes/in-memory-email.sender";
import { InMemoryUsersRepository } from "../../../test/fakes/in-memory-users.repository";
import { AuthTokensRepositoryPort } from "../application/ports/auth-tokens-repository.port";
import { EmailSenderPort } from "../application/ports/email-sender.port";
import { OpaqueTokenPort } from "../application/ports/opaque-token.port";
import { UsersRepositoryPort } from "../application/ports/users-repository.port";
import { ForgotPasswordRateLimiter } from "./forgot-password-rate-limiter";

const RATE_LIMIT_MAX = 3;

const successMessage =
  "If an account exists for this email, we sent a password reset link.";

const seededUser = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
};

function extractToken(text: string): string {
  const match = /token=(\S+)/.exec(text);

  if (match?.[1] === undefined) {
    throw new Error("Reset token not found in the email");
  }

  return match[1];
}

describe("POST /api/v1/auth/forgot-password", () => {
  let app: INestApplication;
  let users: InMemoryUsersRepository;
  let authTokens: InMemoryAuthTokensRepository;
  let emails: InMemoryEmailSender;
  let opaqueTokens: FakeOpaqueToken;
  let limiter: ForgotPasswordRateLimiter;

  beforeAll(async () => {
    users = new InMemoryUsersRepository();
    authTokens = new InMemoryAuthTokensRepository();
    emails = new InMemoryEmailSender();
    opaqueTokens = new FakeOpaqueToken();
    limiter = new ForgotPasswordRateLimiter(RATE_LIMIT_MAX, 60);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(UsersRepositoryPort)
      .useValue(users)
      .overrideProvider(AuthTokensRepositoryPort)
      .useValue(authTokens)
      .overrideProvider(EmailSenderPort)
      .useValue(emails)
      .overrideProvider(OpaqueTokenPort)
      .useValue(opaqueTokens)
      .overrideProvider(ForgotPasswordRateLimiter)
      .useValue(limiter)
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
  });

  beforeEach(() => {
    users.users.length = 0;
    authTokens.tokens.length = 0;
    emails.messages.length = 0;
    emails.failure = null;
    limiter.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it("deve enviar e-mail e persistir apenas o hash para conta confirmada", async () => {
    const account = users.seed({
      ...seededUser,
      emailConfirmedAt: new Date(),
    });

    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/forgot-password")
      .send({ email: " ADA@Example.COM " })
      .expect(200);

    expect(response.body).toEqual({ message: successMessage });
    expect(response.headers["set-cookie"]).toBeUndefined();

    const stored = authTokens.tokens[0];
    expect(stored?.userId).toBe(account.id);
    expect(stored?.purpose).toBe("password_reset");
    expect(stored?.usedAt).toBeNull();
    expect(stored?.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(stored?.expiresAt.getTime()).toBeLessThanOrEqual(
      Date.now() + 3_600 * 1000,
    );

    const message = emails.messages[0];
    expect(message?.to).toBe("ada@example.com");
    expect(message?.subject).toBe("Reset your password");

    const clearToken = extractToken(message?.text ?? "");
    expect(stored?.tokenHash).toBe(opaqueTokens.hash(clearToken));
    expect(stored?.tokenHash).not.toBe(clearToken);
    expect(message?.text).toContain(
      `http://localhost:3000/auth/reset-password?token=${clearToken}`,
    );

    expect(response.text).not.toContain(clearToken);
    expect(response.text).not.toContain(stored?.tokenHash ?? "");
  });

  it("deve enviar recuperação para conta não confirmada", async () => {
    users.seed({ ...seededUser, emailConfirmedAt: null });

    await request(app.getHttpServer())
      .post("/api/v1/auth/forgot-password")
      .send({ email: seededUser.email })
      .expect(200);

    expect(authTokens.tokens).toHaveLength(1);
    expect(emails.messages).toHaveLength(1);
  });

  it("deve responder a mesma mensagem para e-mail inexistente sem enviar nada", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/forgot-password")
      .send({ email: "nobody@example.com" })
      .expect(200);

    expect(response.body).toEqual({ message: successMessage });
    expect(authTokens.tokens).toHaveLength(0);
    expect(emails.messages).toHaveLength(0);
  });

  it("deve responder 400 com erro de campo para e-mail inválido", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/forgot-password")
      .send({ email: "not-an-email" })
      .expect(400);

    expect(response.body).toEqual({
      code: "VALIDATION_ERROR",
      message: "Check the highlighted fields and try again.",
      fieldErrors: { email: "Enter a valid email address." },
    });
    expect(authTokens.tokens).toHaveLength(0);
    expect(emails.messages).toHaveLength(0);
  });

  it("deve invalidar o token pendente anterior ao emitir um novo", async () => {
    users.seed(seededUser);

    await request(app.getHttpServer())
      .post("/api/v1/auth/forgot-password")
      .send({ email: seededUser.email })
      .expect(200);
    await request(app.getHttpServer())
      .post("/api/v1/auth/forgot-password")
      .send({ email: seededUser.email })
      .expect(200);

    expect(authTokens.tokens).toHaveLength(2);
    expect(authTokens.tokens[0]?.usedAt).not.toBeNull();
    expect(authTokens.tokens[1]?.usedAt).toBeNull();
    expect(emails.messages).toHaveLength(2);
    expect(extractToken(emails.messages[0]?.text ?? "")).not.toBe(
      extractToken(emails.messages[1]?.text ?? ""),
    );
  });

  it("deve responder 429 com Retry-After após exceder o limite", async () => {
    for (let attempt = 0; attempt < RATE_LIMIT_MAX; attempt += 1) {
      await request(app.getHttpServer())
        .post("/api/v1/auth/forgot-password")
        .send({ email: "nobody@example.com" })
        .expect(200);
    }

    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/forgot-password")
      .send({ email: "nobody@example.com" })
      .expect(429);

    expect(response.body).toEqual({
      code: "TOO_MANY_REQUESTS",
      message: "Too many attempts. Wait a moment and try again.",
    });
    expect(Number(response.headers["retry-after"])).toBeGreaterThan(0);
    expect(response.text).not.toMatch(/stack|postgres|token/i);
  });

  it("deve manter a resposta genérica quando o e-mail falha e permitir nova tentativa", async () => {
    users.seed(seededUser);
    emails.failure = new Error("smtp connection refused");

    const failure = await request(app.getHttpServer())
      .post("/api/v1/auth/forgot-password")
      .send({ email: seededUser.email })
      .expect(200);

    expect(failure.body).toEqual({ message: successMessage });
    expect(authTokens.tokens).toHaveLength(1);
    expect(emails.messages).toHaveLength(0);

    emails.failure = null;

    await request(app.getHttpServer())
      .post("/api/v1/auth/forgot-password")
      .send({ email: seededUser.email })
      .expect(200);

    expect(authTokens.tokens).toHaveLength(2);
    expect(authTokens.tokens[0]?.usedAt).not.toBeNull();
    expect(authTokens.tokens[1]?.usedAt).toBeNull();
    expect(emails.messages).toHaveLength(1);
  });

  it("não deve registrar e-mail ou token nos logs", async () => {
    const lines: string[] = [];
    const capture = (...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    };

    vi.spyOn(console, "log").mockImplementation(capture);
    vi.spyOn(console, "warn").mockImplementation(capture);
    vi.spyOn(console, "error").mockImplementation(capture);

    users.seed(seededUser);

    await request(app.getHttpServer())
      .post("/api/v1/auth/forgot-password")
      .send({ email: seededUser.email })
      .expect(200);

    const clearToken = extractToken(emails.messages[0]?.text ?? "");

    emails.failure = new Error(`smtp down for ${seededUser.email}`);
    await request(app.getHttpServer())
      .post("/api/v1/auth/forgot-password")
      .send({ email: seededUser.email })
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/v1/auth/forgot-password")
      .send({ email: "nobody@example.com" })
      .expect(200);

    const output = lines.join("\n");

    expect(output.length).toBeGreaterThan(0);
    expect(output).not.toContain(seededUser.email);
    expect(output).not.toContain("nobody@example.com");
    expect(output).not.toContain(clearToken);
    expect(output).not.toContain(authTokens.tokens[0]?.tokenHash ?? "");
  });
});
