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
import { FakePasswordHasher } from "../../../test/fakes/fake-password-hasher";
import { InMemoryAuthTokensRepository } from "../../../test/fakes/in-memory-auth-tokens.repository";
import { InMemoryEmailSender } from "../../../test/fakes/in-memory-email.sender";
import { InMemoryUsersRepository } from "../../../test/fakes/in-memory-users.repository";
import { AuthTokensRepositoryPort } from "../application/ports/auth-tokens-repository.port";
import { EmailSenderPort } from "../application/ports/email-sender.port";
import { OpaqueTokenPort } from "../application/ports/opaque-token.port";
import { PasswordHasherPort } from "../application/ports/password-hasher.port";
import { UsersRepositoryPort } from "../application/ports/users-repository.port";
import { SignUpRateLimiter } from "./sign-up-rate-limiter";

const RATE_LIMIT_MAX = 3;

const validBody = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  password: "correct horse battery staple",
  passwordConfirmation: "correct horse battery staple",
};

const successMessage = "Check your email to confirm your account.";

function extractToken(text: string): string {
  const match = /token=(\S+)/.exec(text);

  if (match?.[1] === undefined) {
    throw new Error("Confirmation token not found in the email");
  }

  return match[1];
}

describe("POST /api/v1/auth/sign-up", () => {
  let app: INestApplication;
  let users: InMemoryUsersRepository;
  let authTokens: InMemoryAuthTokensRepository;
  let emails: InMemoryEmailSender;
  let opaqueTokens: FakeOpaqueToken;
  let limiter: SignUpRateLimiter;

  beforeAll(async () => {
    users = new InMemoryUsersRepository();
    authTokens = new InMemoryAuthTokensRepository();
    emails = new InMemoryEmailSender();
    opaqueTokens = new FakeOpaqueToken();
    limiter = new SignUpRateLimiter(RATE_LIMIT_MAX, 60);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(UsersRepositoryPort)
      .useValue(users)
      .overrideProvider(AuthTokensRepositoryPort)
      .useValue(authTokens)
      .overrideProvider(EmailSenderPort)
      .useValue(emails)
      .overrideProvider(PasswordHasherPort)
      .useValue(new FakePasswordHasher())
      .overrideProvider(OpaqueTokenPort)
      .useValue(opaqueTokens)
      .overrideProvider(SignUpRateLimiter)
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

  it("deve criar conta não confirmada, enviar e-mail e não abrir sessão", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/sign-up")
      .send(validBody)
      .expect(201);

    expect(response.body).toEqual({
      message: successMessage,
      user: {
        id: expect.any(String),
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
      },
    });
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain(validBody.password);

    const account = users.users[0];
    expect(account?.emailConfirmedAt).toBeNull();
    expect(account?.passwordHash).toBe(`fake-hash:${validBody.password}`);

    const storedToken = authTokens.tokens[0];
    expect(storedToken?.purpose).toBe("email_confirmation");
    expect(storedToken?.usedAt).toBeNull();

    const message = emails.messages[0];
    expect(message?.to).toBe("ada@example.com");
    expect(message?.subject).toBe("Confirm your account");
    const clearToken = extractToken(message?.text ?? "");

    expect(storedToken?.tokenHash).toBe(opaqueTokens.hash(clearToken));
    expect(storedToken?.tokenHash).not.toBe(clearToken);
    expect(message?.text).toContain(
      `http://localhost:3000/auth/confirm?token=${clearToken}`,
    );

    await request(app.getHttpServer()).get("/api/v1/auth/me").expect(401);
  });

  it("deve normalizar nome e e-mail antes de persistir", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/sign-up")
      .send({
        ...validBody,
        firstName: "  Ada ",
        lastName: " Lovelace  ",
        email: " ADA@Example.COM ",
      })
      .expect(201);

    expect(response.body.user).toMatchObject({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
    });
    expect(users.users[0]?.email).toBe("ada@example.com");
  });

  it("deve responder 400 com erro por campo e não criar conta", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/sign-up")
      .send({ email: "not-an-email" })
      .expect(400);

    expect(response.body).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Check the highlighted fields and try again.",
    });
    expect(Object.keys(response.body.fieldErrors).sort()).toEqual([
      "email",
      "firstName",
      "lastName",
      "password",
      "passwordConfirmation",
    ]);

    for (const message of Object.values(response.body.fieldErrors)) {
      expect(typeof message).toBe("string");
    }

    expect(response.body.fieldErrors.email).toBe(
      "Enter a valid email address.",
    );
    expect(users.users).toHaveLength(0);
    expect(emails.messages).toHaveLength(0);
  });

  it("deve responder 400 quando a confirmação de senha é diferente", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/sign-up")
      .send({ ...validBody, passwordConfirmation: "something else" })
      .expect(400);

    expect(response.body.fieldErrors).toEqual({
      passwordConfirmation: "Passwords do not match.",
    });
    expect(users.users).toHaveLength(0);
  });

  it("deve responder 409 para e-mail já confirmado sem duplicar a conta", async () => {
    users.seed({ ...validBody, emailConfirmedAt: new Date() });

    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/sign-up")
      .send(validBody)
      .expect(409);

    expect(response.body).toEqual({
      code: "EMAIL_ALREADY_CONFIRMED",
      message: "An account with this email already exists. Sign in instead.",
    });
    expect(users.users).toHaveLength(1);
    expect(emails.messages).toHaveLength(0);
  });

  it("deve responder 200 e reenviar a confirmação para e-mail não confirmado", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/sign-up")
      .send(validBody)
      .expect(201);

    const firstToken = authTokens.tokens[0];

    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/sign-up")
      .send(validBody)
      .expect(200);

    expect(response.body).toEqual({ message: successMessage });
    expect(users.users).toHaveLength(1);
    expect(authTokens.tokens).toHaveLength(2);
    expect(firstToken?.usedAt).not.toBeNull();
    expect(authTokens.tokens[1]?.usedAt).toBeNull();
    expect(emails.messages).toHaveLength(2);
    expect(extractToken(emails.messages[0]?.text ?? "")).not.toBe(
      extractToken(emails.messages[1]?.text ?? ""),
    );
  });

  it("deve responder 429 com Retry-After após exceder o limite", async () => {
    for (let attempt = 0; attempt < RATE_LIMIT_MAX; attempt += 1) {
      await request(app.getHttpServer())
        .post("/api/v1/auth/sign-up")
        .send(validBody)
        .expect(attempt === 0 ? 201 : 200);
    }

    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/sign-up")
      .send(validBody)
      .expect(429);

    expect(response.body).toEqual({
      code: "TOO_MANY_REQUESTS",
      message: "Too many attempts. Wait a moment and try again.",
    });
    expect(Number(response.headers["retry-after"])).toBeGreaterThan(0);
    expect(response.text).not.toMatch(/stack|postgres|scrypt|token/i);
  });

  it("deve responder 503 quando o e-mail falha e permitir nova tentativa", async () => {
    emails.failure = new Error("smtp connection refused");

    const failure = await request(app.getHttpServer())
      .post("/api/v1/auth/sign-up")
      .send(validBody)
      .expect(503);

    expect(failure.body).toEqual({
      code: "CONFIRMATION_EMAIL_FAILED",
      message:
        "We could not send the confirmation email. Try again in a moment.",
    });
    expect(users.users).toHaveLength(1);
    expect(authTokens.tokens).toHaveLength(1);
    expect(emails.messages).toHaveLength(0);

    emails.failure = null;

    await request(app.getHttpServer())
      .post("/api/v1/auth/sign-up")
      .send(validBody)
      .expect(200);

    expect(users.users).toHaveLength(1);
    expect(authTokens.tokens).toHaveLength(2);
    expect(authTokens.tokens[0]?.usedAt).not.toBeNull();
    expect(emails.messages).toHaveLength(1);
  });

  it("não deve expor senha, hash ou token na resposta", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/sign-up")
      .send(validBody)
      .expect(201);

    expect(response.text).not.toContain(validBody.password);
    expect(response.text).not.toContain("fake-hash");
    expect(response.text).not.toContain("token");
    expect(response.text).not.toMatch(/stack|postgres|scrypt/i);
  });

  it("não deve registrar e-mail, senha ou token nos logs", async () => {
    const lines: string[] = [];
    const capture = (...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    };

    vi.spyOn(console, "log").mockImplementation(capture);
    vi.spyOn(console, "warn").mockImplementation(capture);
    vi.spyOn(console, "error").mockImplementation(capture);

    await request(app.getHttpServer())
      .post("/api/v1/auth/sign-up")
      .send(validBody)
      .expect(201);

    const clearToken = extractToken(emails.messages[0]?.text ?? "");

    emails.failure = new Error(`smtp down for ${validBody.email}`);
    await request(app.getHttpServer())
      .post("/api/v1/auth/sign-up")
      .send(validBody)
      .expect(503);

    await request(app.getHttpServer())
      .post("/api/v1/auth/sign-up")
      .send({ ...validBody, passwordConfirmation: "something else" })
      .expect(400);

    const output = lines.join("\n");

    expect(output.length).toBeGreaterThan(0);
    expect(output).not.toContain(validBody.email);
    expect(output).not.toContain(validBody.password);
    expect(output).not.toContain("something else");
    expect(output).not.toContain(clearToken);
    expect(output).not.toContain(authTokens.tokens[0]?.tokenHash ?? "");
  });
});
