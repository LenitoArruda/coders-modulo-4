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
import { FakePasswordHasher } from "../../../test/fakes/fake-password-hasher";
import { InMemoryEmailSender } from "../../../test/fakes/in-memory-email.sender";
import { InMemorySessionsRepository } from "../../../test/fakes/in-memory-sessions.repository";
import { InMemoryUsersRepository } from "../../../test/fakes/in-memory-users.repository";
import { EmailSenderPort } from "../application/ports/email-sender.port";
import { PasswordHasherPort } from "../application/ports/password-hasher.port";
import { SessionTokenPort } from "../application/ports/session-token.port";
import { SessionsRepositoryPort } from "../application/ports/sessions-repository.port";
import { UsersRepositoryPort } from "../application/ports/users-repository.port";

import { SignInRateLimiter } from "./sign-in-rate-limiter";

const RATE_LIMIT_MAX = 5;
const PASSWORD = "correct horse battery staple";
const SIGN_IN_PATH = "/api/v1/auth/sign-in";

const INVALID_BODY = {
  code: "INVALID_CREDENTIALS",
  message: "Invalid email or password.",
};

const ada = {
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

describe("POST /api/v1/auth/sign-in", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let users: InMemoryUsersRepository;
  let sessions: InMemorySessionsRepository;
  let emails: InMemoryEmailSender;
  let limiter: SignInRateLimiter;
  const hasher = new FakePasswordHasher();

  beforeAll(async () => {
    users = new InMemoryUsersRepository();
    sessions = new InMemorySessionsRepository();
    emails = new InMemoryEmailSender();
    limiter = new SignInRateLimiter(RATE_LIMIT_MAX, 60);

    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(UsersRepositoryPort)
      .useValue(users)
      .overrideProvider(SessionsRepositoryPort)
      .useValue(sessions)
      .overrideProvider(EmailSenderPort)
      .useValue(emails)
      .overrideProvider(PasswordHasherPort)
      .useValue(hasher)
      .overrideProvider(SignInRateLimiter)
      .useValue(limiter)
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
  });

  beforeEach(() => {
    users.users.length = 0;
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

  async function seedAccount(emailConfirmedAt: Date | null = new Date()) {
    return users.seed({
      ...ada,
      emailConfirmedAt,
      passwordHash: await hasher.hash(PASSWORD),
    });
  }

  function signIn(body: unknown) {
    return request(app.getHttpServer())
      .post(SIGN_IN_PATH)
      .send(body as object);
  }

  it("deve autenticar, criar sessão sign_in e devolver o contrato do JWT", async () => {
    const account = await seedAccount();

    const response = await signIn({
      email: "  Ada@Example.com ",
      password: PASSWORD,
    }).expect(200);

    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(response.body).toEqual({
      accessToken: expect.any(String),
      tokenType: "Bearer",
      expiresIn: 3600,
      user: { id: account.id, ...ada },
    });
    expect(response.text).not.toContain(PASSWORD);
    expect(response.text).not.toContain("fake-hash");

    expect(sessions.sessions).toHaveLength(1);
    expect(sessions.sessions[0]).toMatchObject({
      userId: account.id,
      origin: "sign_in",
      revokedAt: null,
    });
    expect(emails.messages).toHaveLength(1);
    expect(emails.messages[0]?.subject).toBe("New session on your account");

    const claims = jwtClaims(response.body.accessToken as string);

    expect(Object.keys(claims).sort()).toEqual(["exp", "iat", "sid", "sub"]);
    expect(claims.sub).toBe(account.id);
    expect(claims.sid).toBe(sessions.sessions[0]?.id);

    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${response.body.accessToken as string}`)
      .expect(200);

    expect(me.body).toEqual({ user: { id: account.id, ...ada } });
  });

  it("deve responder 401 genérico para senha incorreta e e-mail inexistente", async () => {
    await seedAccount();

    const wrongPassword = await signIn({
      email: ada.email,
      password: "wrong-password",
    }).expect(401);
    const unknownEmail = await signIn({
      email: "ghost@example.com",
      password: PASSWORD,
    }).expect(401);
    const badFormat = await signIn({
      email: "not-an-email",
      password: PASSWORD,
    }).expect(401);

    for (const response of [wrongPassword, unknownEmail, badFormat]) {
      expect(response.body).toEqual(INVALID_BODY);
      expect(response.headers["set-cookie"]).toBeUndefined();
    }

    expect(wrongPassword.text).toBe(unknownEmail.text);
    expect(sessions.sessions).toHaveLength(0);
    expect(emails.messages).toHaveLength(0);
  });

  it("deve responder 400 para corpo malformado ou campos vazios, sem sessão", async () => {
    await seedAccount();

    for (const body of [
      {},
      { email: ada.email },
      { password: PASSWORD },
      { email: "", password: "" },
      { email: 1, password: PASSWORD },
      { email: ada.email, password: "a".repeat(129) },
    ]) {
      const response = await signIn(body).expect(400);

      expect(response.body).toEqual({
        code: "VALIDATION_ERROR",
        message: "Enter your email address and password.",
      });
      expect(response.headers["set-cookie"]).toBeUndefined();
    }

    expect(sessions.sessions).toHaveLength(0);
    expect(emails.messages).toHaveLength(0);
  });

  it("deve aceitar senha curta no sign-in (sem mínimo) e responder 401", async () => {
    await seedAccount();

    await signIn({ email: ada.email, password: "x" }).expect(401);
  });

  it("deve responder 403 para conta não confirmada com a senha correta", async () => {
    await seedAccount(null);

    const response = await signIn({
      email: ada.email,
      password: PASSWORD,
    }).expect(403);

    expect(response.body).toEqual({
      code: "EMAIL_NOT_CONFIRMED",
      message: "Please confirm your email before signing in.",
    });
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(sessions.sessions).toHaveLength(0);
    expect(emails.messages).toHaveLength(0);
  });

  it("não deve revelar conta não confirmada a quem erra a senha", async () => {
    await seedAccount(null);

    const response = await signIn({
      email: ada.email,
      password: "wrong-password",
    }).expect(401);

    expect(response.body).toEqual(INVALID_BODY);
    expect(sessions.sessions).toHaveLength(0);
  });

  it("deve revogar a sessão anterior: JWT antigo 401 e JWT novo 200", async () => {
    const account = await seedAccount();
    const first = await signIn({ email: ada.email, password: PASSWORD }).expect(
      200,
    );
    const second = await signIn({
      email: ada.email,
      password: PASSWORD,
    }).expect(200);

    await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${first.body.accessToken as string}`)
      .expect(401);

    await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${second.body.accessToken as string}`)
      .expect(200);

    expect(
      sessions.sessions.filter(
        (session) =>
          session.userId === account.id && session.revokedAt === null,
      ),
    ).toHaveLength(1);
    expect(emails.messages).toHaveLength(2);
  });

  it("deve manter no máximo uma sessão ativa sob sign-ins simultâneos", async () => {
    await seedAccount();

    const responses = await Promise.all([
      signIn({ email: ada.email, password: PASSWORD }),
      signIn({ email: ada.email, password: PASSWORD }),
      signIn({ email: ada.email, password: PASSWORD }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([
      200, 200, 200,
    ]);

    const active = await Promise.all(
      sessions.sessions.map((session) => sessions.findActiveById(session.id)),
    );

    expect(
      active.filter((session) => session !== null).length,
    ).toBeLessThanOrEqual(1);
  });

  it("deve manter a sessão e responder 200 quando o e-mail de nova sessão falha", async () => {
    await seedAccount();
    emails.failure = new Error("smtp down");

    const response = await signIn({
      email: ada.email,
      password: PASSWORD,
    }).expect(200);

    expect(sessions.sessions).toHaveLength(1);

    await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${response.body.accessToken as string}`)
      .expect(200);
  });

  it("deve permitir 5 tentativas e responder 429 com Retry-After na 6ª", async () => {
    await seedAccount();

    for (let attempt = 0; attempt < RATE_LIMIT_MAX; attempt += 1) {
      await signIn({ email: ada.email, password: "wrong-password" }).expect(
        401,
      );
    }

    const response = await signIn({
      email: ada.email,
      password: PASSWORD,
    }).expect(429);

    expect(response.body).toEqual({
      code: "TOO_MANY_REQUESTS",
      message: "Too many attempts. Wait a moment and try again.",
    });
    expect(Number(response.headers["retry-after"])).toBeGreaterThan(0);
    expect(response.text).not.toMatch(/stack|postgres|ada/i);
    expect(sessions.sessions).toHaveLength(0);
  });

  it("deve contar por IP + e-mail normalizado e isolar outros e-mails", async () => {
    await seedAccount();

    for (let attempt = 0; attempt < RATE_LIMIT_MAX; attempt += 1) {
      await signIn({
        email: attempt % 2 === 0 ? ada.email : " ADA@example.com ",
        password: "wrong-password",
      }).expect(401);
    }

    await signIn({ email: ada.email, password: PASSWORD }).expect(429);

    const other = await signIn({
      email: "ghost@example.com",
      password: "wrong-password",
    }).expect(401);

    expect(other.body).toEqual(INVALID_BODY);
  });

  it("não deve registrar e-mail, senha ou JWT nos logs", async () => {
    const lines: string[] = [];
    const capture = (...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    };

    vi.spyOn(console, "log").mockImplementation(capture);
    vi.spyOn(console, "warn").mockImplementation(capture);
    vi.spyOn(console, "error").mockImplementation(capture);

    await seedAccount();
    emails.failure = new Error(`smtp down for ${ada.email}`);

    const ok = await signIn({ email: ada.email, password: PASSWORD }).expect(
      200,
    );

    await signIn({ email: ada.email, password: "wrong-password" }).expect(401);
    await signIn({ email: "ghost@example.com", password: PASSWORD }).expect(
      401,
    );

    const output = lines.join("\n");

    expect(output.length).toBeGreaterThan(0);
    expect(output).not.toContain(ada.email);
    expect(output).not.toContain("ghost@example.com");
    expect(output).not.toContain(PASSWORD);
    expect(output).not.toContain("wrong-password");
    expect(output).not.toContain(ok.body.accessToken as string);
  });

  it("deve aceitar o JWT recém-emitido pelo SessionTokenPort", async () => {
    const account = await seedAccount();
    const response = await signIn({
      email: ada.email,
      password: PASSWORD,
    }).expect(200);

    const verified = await moduleRef
      .get(SessionTokenPort)
      .verify(response.body.accessToken as string);

    expect(verified).toMatchObject({ userId: account.id });
  });
});
