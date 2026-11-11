import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../../../app.module";
import { configureApp } from "../../../app-setup";
import { InMemoryEmailSender } from "../../../test/fakes/in-memory-email.sender";
import {
  activeSession,
  InMemorySessionsRepository,
} from "../../../test/fakes/in-memory-sessions.repository";
import { InMemoryUsersRepository } from "../../../test/fakes/in-memory-users.repository";
import { loadEnv } from "../../shared/config/env";
import { EmailSenderPort } from "../application/ports/email-sender.port";
import { SessionTokenPort } from "../application/ports/session-token.port";
import { SessionsRepositoryPort } from "../application/ports/sessions-repository.port";
import { UsersRepositoryPort } from "../application/ports/users-repository.port";
import type { AuthUser } from "../domain/auth-user";
import { JoseSessionTokenAdapter } from "../infrastructure/jose-session-token.adapter";

const INVALID_SESSION_BODY = {
  code: "UNAUTHORIZED",
  message: "Your session is invalid or has expired. Sign in again.",
};

const user: AuthUser = {
  id: "11111111-1111-1111-1111-111111111111",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
};

describe("GET /api/v1/auth/me", () => {
  let app: INestApplication;
  let sessions: InMemorySessionsRepository;
  let users: InMemoryUsersRepository;
  let tokens: SessionTokenPort;
  let expiredTokens: JoseSessionTokenAdapter;

  beforeAll(async () => {
    sessions = new InMemorySessionsRepository();
    users = new InMemoryUsersRepository();
    users.seed(user);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SessionsRepositoryPort)
      .useValue(sessions)
      .overrideProvider(UsersRepositoryPort)
      .useValue(users)
      .overrideProvider(EmailSenderPort)
      .useValue(new InMemoryEmailSender())
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    tokens = moduleRef.get(SessionTokenPort);
    expiredTokens = new JoseSessionTokenAdapter(loadEnv().jwtSecret, -60);
  });

  afterAll(async () => {
    await app.close();
  });

  function seedTokenFor(
    sessionId: string,
    subject: string = user.id,
    adapter: SessionTokenPort = tokens,
  ): Promise<string> {
    return adapter.sign({ userId: subject, sessionId });
  }

  it("deve devolver os dados básicos com JWT válido e sessão ativa", async () => {
    const session = sessions.seed(activeSession(user.id));
    const token = await seedTokenFor(session.id);

    const response = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({ user });
  });

  it("deve responder 401 com o contrato quando não há header", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .expect(401);

    expect(response.body).toEqual(INVALID_SESSION_BODY);
  });

  it("deve responder 401 para token malformado", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer not-a-jwt")
      .expect(401);

    expect(response.body).toEqual(INVALID_SESSION_BODY);
  });

  it("deve responder 401 para esquema que não é Bearer", async () => {
    const session = sessions.seed(activeSession(user.id));
    const token = await seedTokenFor(session.id);

    const response = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Token ${token}`)
      .expect(401);

    expect(response.body).toEqual(INVALID_SESSION_BODY);
  });

  it("deve responder 401 para JWT expirado", async () => {
    const session = sessions.seed(activeSession(user.id));
    const token = await seedTokenFor(session.id, user.id, expiredTokens);

    const response = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(401);

    expect(response.body).toEqual(INVALID_SESSION_BODY);
  });

  it("deve responder 401 para sessão revogada", async () => {
    const session = sessions.seed({
      ...activeSession(user.id),
      revokedAt: new Date(),
    });
    const token = await seedTokenFor(session.id);

    const response = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(401);

    expect(response.body).toEqual(INVALID_SESSION_BODY);
  });

  it("deve responder 401 para sessão expirada no registro", async () => {
    const session = sessions.seed({
      ...activeSession(user.id),
      expiresAt: new Date(Date.now() - 60_000),
    });
    const token = await seedTokenFor(session.id);

    const response = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(401);

    expect(response.body).toEqual(INVALID_SESSION_BODY);
  });

  it("deve responder 401 quando o sid não existe", async () => {
    const token = await seedTokenFor("33333333-3333-3333-3333-333333333333");

    const response = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(401);

    expect(response.body).toEqual(INVALID_SESSION_BODY);
  });

  it("deve responder 401 quando o sub não é dono da sessão", async () => {
    const session = sessions.seed(activeSession(user.id));
    const token = await seedTokenFor(
      session.id,
      "44444444-4444-4444-4444-444444444444",
    );

    const response = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(401);

    expect(response.body).toEqual(INVALID_SESSION_BODY);
  });

  it("deve responder 401 quando a pessoa da sessão não existe mais", async () => {
    const session = sessions.seed(
      activeSession("55555555-5555-5555-5555-555555555555"),
    );
    const token = await seedTokenFor(
      session.id,
      "55555555-5555-5555-5555-555555555555",
    );

    const response = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(401);

    expect(response.body).toEqual(INVALID_SESSION_BODY);
  });

  it("não deve expor detalhes internos no 401", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .expect(401);

    expect(Object.keys(response.body).sort()).toEqual(["code", "message"]);
    expect(response.text).not.toMatch(/stack|jwt|token|session_id|postgres/i);
  });
});
