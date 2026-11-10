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
import { EmailSenderPort } from "../application/ports/email-sender.port";
import { SessionTokenPort } from "../application/ports/session-token.port";
import { SessionsRepositoryPort } from "../application/ports/sessions-repository.port";
import { UsersRepositoryPort } from "../application/ports/users-repository.port";
import type { AuthUser } from "../domain/auth-user";

const user: AuthUser = {
  id: "11111111-1111-1111-1111-111111111111",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
};

describe("POST /api/v1/auth/sign-out", () => {
  let app: INestApplication;
  let sessions: InMemorySessionsRepository;
  let tokens: SessionTokenPort;

  beforeAll(async () => {
    sessions = new InMemorySessionsRepository();
    const users = new InMemoryUsersRepository();

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
  });

  afterAll(async () => {
    await app.close();
  });

  it("deve responder 204 e invalidar o token imediatamente", async () => {
    const session = sessions.seed(activeSession(user.id));
    const token = await tokens.sign({ userId: user.id, sessionId: session.id });

    await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/sign-out")
      .set("Authorization", `Bearer ${token}`)
      .expect(204);

    expect(response.text).toBe("");

    await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(401);
  });

  it("deve responder 401 quando repetido com o mesmo token", async () => {
    const session = sessions.seed(activeSession(user.id));
    const token = await tokens.sign({ userId: user.id, sessionId: session.id });

    await request(app.getHttpServer())
      .post("/api/v1/auth/sign-out")
      .set("Authorization", `Bearer ${token}`)
      .expect(204);
    await request(app.getHttpServer())
      .post("/api/v1/auth/sign-out")
      .set("Authorization", `Bearer ${token}`)
      .expect(401);
  });

  it("deve responder 401 sem token ou com token malformado", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/sign-out")
      .expect(401);
    await request(app.getHttpServer())
      .post("/api/v1/auth/sign-out")
      .set("Authorization", "Bearer not-a-jwt")
      .expect(401);
  });

  it("não deve encerrar outras sessões nem as de outra pessoa", async () => {
    const mine = sessions.seed(activeSession(user.id));
    const other = sessions.seed(activeSession(user.id));
    const token = await tokens.sign({ userId: user.id, sessionId: mine.id });

    await request(app.getHttpServer())
      .post("/api/v1/auth/sign-out")
      .set("Authorization", `Bearer ${token}`)
      .expect(204);

    await expect(sessions.findActiveById(other.id)).resolves.not.toBeNull();
  });
});
