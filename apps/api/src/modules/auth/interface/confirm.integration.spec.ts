import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
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
import { InMemorySessionsRepository } from "../../../test/fakes/in-memory-sessions.repository";
import { InMemoryUsersRepository } from "../../../test/fakes/in-memory-users.repository";
import { AuthTokensRepositoryPort } from "../application/ports/auth-tokens-repository.port";
import { EmailSenderPort } from "../application/ports/email-sender.port";
import { OpaqueTokenPort } from "../application/ports/opaque-token.port";
import { SessionTokenPort } from "../application/ports/session-token.port";
import { SessionsRepositoryPort } from "../application/ports/sessions-repository.port";
import { UsersRepositoryPort } from "../application/ports/users-repository.port";
import type { AuthUser } from "../domain/auth-user";
import { ConfirmationRateLimiter } from "./confirmation-rate-limiter";

const RATE_LIMIT_MAX = 3;
const INVALID_BODY = {
  code: "INVALID_CONFIRMATION_TOKEN",
  message: "This confirmation link is invalid or has expired.",
};
const CONFIRMED_BODY = {
  code: "ACCOUNT_ALREADY_CONFIRMED",
  message: "This account is already confirmed. Sign in instead.",
};

const user: AuthUser = {
  id: "11111111-1111-1111-1111-111111111111",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
};

function jwtClaims(token: string): Record<string, unknown> {
  const payload = token.split(".")[1] ?? "";

  return JSON.parse(
    Buffer.from(payload, "base64url").toString("utf8"),
  ) as Record<string, unknown>;
}

describe("POST /api/v1/auth/confirm", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let users: InMemoryUsersRepository;
  let authTokens: InMemoryAuthTokensRepository;
  let sessions: InMemorySessionsRepository;
  let emails: InMemoryEmailSender;
  let opaqueTokens: FakeOpaqueToken;
  let limiter: ConfirmationRateLimiter;

  beforeAll(async () => {
    users = new InMemoryUsersRepository();
    authTokens = new InMemoryAuthTokensRepository();
    sessions = new InMemorySessionsRepository();
    emails = new InMemoryEmailSender();
    opaqueTokens = new FakeOpaqueToken();
    limiter = new ConfirmationRateLimiter(RATE_LIMIT_MAX, 60);

    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
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
      .overrideProvider(ConfirmationRateLimiter)
      .useValue(limiter)
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  function seedAccount(
    overrides: { emailConfirmedAt?: Date | null } = {},
  ): AuthUser {
    return users.seed({
      ...user,
      ...overrides,
    });
  }

  async function seedToken(account: AuthUser): Promise<string> {
    const generated = opaqueTokens.generate();

    await authTokens.create({
      userId: account.id,
      purpose: "email_confirmation",
      tokenHash: generated.hash,
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    return generated.token;
  }

  it("deve confirmar, consumir o token, criar sessão e devolver o JWT", async () => {
    seedAccount();
    const token = await seedToken(user);

    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/confirm")
      .send({ token })
      .expect(200);

    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(response.body).toEqual({
      accessToken: expect.any(String),
      tokenType: "Bearer",
      expiresIn: 3600,
      user,
    });
    expect(response.text).not.toContain(token);
    expect(response.text).not.toContain("seed-hash");

    expect(users.users[0]?.emailConfirmedAt).not.toBeNull();
    expect(authTokens.tokens[0]?.usedAt).not.toBeNull();
    expect(sessions.sessions).toHaveLength(1);
    expect(sessions.sessions[0]).toMatchObject({
      userId: user.id,
      origin: "sign_up_confirmation",
      revokedAt: null,
    });
    expect(emails.messages).toHaveLength(1);
    expect(emails.messages[0]?.subject).toBe("New session on your account");

    const claims = jwtClaims(response.body.accessToken as string);
    expect(Object.keys(claims).sort()).toEqual(["exp", "iat", "sid", "sub"]);
    expect(claims.sub).toBe(user.id);
    expect(claims.sid).toBe(sessions.sessions[0]?.id);

    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${response.body.accessToken as string}`)
      .expect(200);

    expect(me.body).toEqual({ user });
  });

  it("deve responder 400 para token desconhecido sem criar sessão", async () => {
    seedAccount();

    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/confirm")
      .send({ token: "unknown-token" })
      .expect(400);

    expect(response.body).toEqual(INVALID_BODY);
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(users.users[0]?.emailConfirmedAt).toBeNull();
    expect(sessions.sessions).toHaveLength(0);
    expect(emails.messages).toHaveLength(0);
  });

  it("deve responder 400 quando o token está ausente no corpo", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/confirm")
      .send({})
      .expect(400);

    expect(response.body).toEqual(INVALID_BODY);
  });

  it("deve responder 400 para token expirado sem confirmar a conta", async () => {
    seedAccount();
    const generated = opaqueTokens.generate();

    await authTokens.create({
      userId: user.id,
      purpose: "email_confirmation",
      tokenHash: generated.hash,
      expiresAt: new Date(Date.now() - 1_000),
    });

    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/confirm")
      .send({ token: generated.token })
      .expect(400);

    expect(response.body).toEqual(INVALID_BODY);
    expect(users.users[0]?.emailConfirmedAt).toBeNull();
    expect(sessions.sessions).toHaveLength(0);
  });

  it("deve responder 400 para token já usado e conta não confirmada", async () => {
    seedAccount();
    const token = await seedToken(user);

    authTokens.tokens[0]!.usedAt = new Date();

    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/confirm")
      .send({ token })
      .expect(400);

    expect(response.body).toEqual(INVALID_BODY);
    expect(sessions.sessions).toHaveLength(0);
  });

  it("deve responder 409 para conta já confirmada sem nova sessão", async () => {
    seedAccount({ emailConfirmedAt: new Date("2026-11-09T12:00:00.000Z") });
    const token = await seedToken(user);

    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/confirm")
      .send({ token })
      .expect(409);

    expect(response.body).toEqual(CONFIRMED_BODY);
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(sessions.sessions).toHaveLength(0);
    expect(emails.messages).toHaveLength(0);
  });

  it("deve responder 409 na segunda confirmação e manter uma única sessão", async () => {
    seedAccount();
    const token = await seedToken(user);

    await request(app.getHttpServer())
      .post("/api/v1/auth/confirm")
      .send({ token })
      .expect(200);

    const second = await request(app.getHttpServer())
      .post("/api/v1/auth/confirm")
      .send({ token })
      .expect(409);

    expect(second.body).toEqual(CONFIRMED_BODY);
    expect(sessions.sessions).toHaveLength(1);
    expect(emails.messages).toHaveLength(1);
  });

  it("deve revogar a sessão anterior e invalidar o JWT antigo", async () => {
    seedAccount();
    const previous = sessions.seed({
      userId: user.id,
      origin: "sign_in",
      createdAt: new Date(Date.now() - 60_000),
      expiresAt: new Date(Date.now() + 3_600_000),
      revokedAt: null,
    });
    const previousJwt = await moduleRef
      .get(SessionTokenPort)
      .sign({ userId: user.id, sessionId: previous.id });
    const token = await seedToken(user);

    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/confirm")
      .send({ token })
      .expect(200);

    expect(previous.revokedAt).not.toBeNull();

    await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${previousJwt}`)
      .expect(401);

    await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${response.body.accessToken as string}`)
      .expect(200);
  });

  it("deve responder 429 com Retry-After após exceder o limite", async () => {
    for (let attempt = 0; attempt < RATE_LIMIT_MAX; attempt += 1) {
      await request(app.getHttpServer())
        .post("/api/v1/auth/confirm")
        .send({ token: "unknown-token" })
        .expect(400);
    }

    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/confirm")
      .send({ token: "unknown-token" })
      .expect(429);

    expect(response.body).toEqual({
      code: "TOO_MANY_REQUESTS",
      message: "Too many attempts. Wait a moment and try again.",
    });
    expect(Number(response.headers["retry-after"])).toBeGreaterThan(0);
    expect(response.text).not.toMatch(/stack|postgres|token/i);
  });

  it("deve manter apenas uma sessão ativa sob confirmações simultâneas", async () => {
    seedAccount();
    const token = await seedToken(user);

    const responses = await Promise.all([
      request(app.getHttpServer()).post("/api/v1/auth/confirm").send({ token }),
      request(app.getHttpServer()).post("/api/v1/auth/confirm").send({ token }),
    ]);
    const statuses = responses.map((response) => response.status).sort();

    expect(statuses[0]).toBe(200);
    expect([400, 409]).toContain(statuses[1]);

    const active = await Promise.all(
      sessions.sessions.map((candidate) =>
        sessions.findActiveById(candidate.id),
      ),
    );

    expect(active.filter((candidate) => candidate !== null)).toHaveLength(1);
  });

  it("não deve registrar e-mail, token ou JWT nos logs", async () => {
    const lines: string[] = [];
    const capture = (...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    };

    vi.spyOn(console, "log").mockImplementation(capture);
    vi.spyOn(console, "warn").mockImplementation(capture);
    vi.spyOn(console, "error").mockImplementation(capture);

    seedAccount();
    const token = await seedToken(user);

    const ok = await request(app.getHttpServer())
      .post("/api/v1/auth/confirm")
      .send({ token })
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/v1/auth/confirm")
      .send({ token })
      .expect(409);

    await request(app.getHttpServer())
      .post("/api/v1/auth/confirm")
      .send({ token: "invalid-token-value" })
      .expect(400);

    const output = lines.join("\n");

    expect(output.length).toBeGreaterThan(0);
    expect(output).not.toContain(user.email);
    expect(output).not.toContain(token);
    expect(output).not.toContain("invalid-token-value");
    expect(output).not.toContain(ok.body.accessToken as string);
  });
});
