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
import { InMemoryConversationsRepository } from "../../../test/fakes/in-memory-conversations.repository";
import { FakeExpertResponder } from "../../../test/fakes/fake-expert-responder";
import { EmailSenderPort } from "../../auth/application/ports/email-sender.port";
import { SessionTokenPort } from "../../auth/application/ports/session-token.port";
import { SessionsRepositoryPort } from "../../auth/application/ports/sessions-repository.port";
import { UsersRepositoryPort } from "../../auth/application/ports/users-repository.port";
import type { AuthUser } from "../../auth/domain/auth-user";
import { ConversationsRepositoryPort } from "../application/ports/conversations-repository.port";
import { ExpertResponderPort } from "../application/ports/expert-responder.port";

const UNAUTHORIZED_BODY = {
  code: "UNAUTHORIZED",
  message: "Your session is invalid or has expired. Sign in again.",
};

const userA: AuthUser = {
  id: "11111111-1111-1111-1111-111111111111",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
};
const userB: AuthUser = {
  id: "22222222-2222-2222-2222-222222222222",
  firstName: "Grace",
  lastName: "Hopper",
  email: "grace@example.com",
};

describe("rotas de Experts e conversas", () => {
  let app: INestApplication;
  let sessions: InMemorySessionsRepository;
  let responder: FakeExpertResponder;
  let conversations: InMemoryConversationsRepository;
  let tokens: SessionTokenPort;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    const users = new InMemoryUsersRepository();
    users.seed(userA);
    users.seed(userB);

    sessions = new InMemorySessionsRepository();
    responder = new FakeExpertResponder();
    conversations = new InMemoryConversationsRepository();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SessionsRepositoryPort)
      .useValue(sessions)
      .overrideProvider(UsersRepositoryPort)
      .useValue(users)
      .overrideProvider(EmailSenderPort)
      .useValue(new InMemoryEmailSender())
      .overrideProvider(ConversationsRepositoryPort)
      .useValue(conversations)
      .overrideProvider(ExpertResponderPort)
      .useValue(responder)
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    tokens = moduleRef.get(SessionTokenPort);

    const sessionA = sessions.seed(activeSession(userA.id));
    const sessionB = sessions.seed(activeSession(userB.id));
    tokenA = await tokens.sign({ userId: userA.id, sessionId: sessionA.id });
    tokenB = await tokens.sign({ userId: userB.id, sessionId: sessionB.id });
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/v1/experts exige sessão", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/experts")
      .expect(401);

    expect(response.body).toEqual(UNAUTHORIZED_BODY);
  });

  it("GET /api/v1/experts devolve os nove Experts em ordem", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/experts")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);

    expect(response.body.experts).toHaveLength(9);
    expect(response.body.experts[0]).toMatchObject({
      id: "cto",
      name: "CTO Expert",
    });
    expect(response.body.experts[8]).toMatchObject({
      id: "cpo",
      name: "CPO Expert",
    });
    expect(response.body.experts[0].suggestions).toHaveLength(3);
  });

  it("GET /api/v1/conversations exige sessão e expertId", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/conversations?expertId=cto")
      .expect(401);

    const response = await request(app.getHttpServer())
      .get("/api/v1/conversations")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(400);

    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("GET /api/v1/conversations retorna estado vazio e rejeita Expert desconhecido", async () => {
    const empty = await request(app.getHttpServer())
      .get("/api/v1/conversations?expertId=cto")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);

    expect(empty.body).toEqual({ conversationId: null, messages: [] });

    const unknown = await request(app.getHttpServer())
      .get("/api/v1/conversations?expertId=nope")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(404);

    expect(unknown.body.code).toBe("UNKNOWN_EXPERT");
  });

  it("POST /api/v1/conversations/messages valida prompt vazio sem chamar o modelo", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/conversations/messages")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ expertId: "cto", prompt: "   " })
      .expect(400);

    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(response.body.fieldErrors.prompt).toBeDefined();
    expect(responder.calls).toHaveLength(0);
  });

  it("envia prompt, persiste o histórico e isola usuários", async () => {
    const sent = await request(app.getHttpServer())
      .post("/api/v1/conversations/messages")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ expertId: "ceo", prompt: "What is our top risk?" })
      .expect(201);

    expect(sent.body.expertMessage.role).toBe("expert");
    expect(sent.body.userMessage.content).toBe("What is our top risk?");

    const historyA = await request(app.getHttpServer())
      .get("/api/v1/conversations?expertId=ceo")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);

    expect(historyA.body.messages).toHaveLength(2);
    expect(
      historyA.body.messages.map((message: { role: string }) => message.role),
    ).toEqual(["user", "expert"]);

    const historyB = await request(app.getHttpServer())
      .get("/api/v1/conversations?expertId=ceo")
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);

    expect(historyB.body).toEqual({ conversationId: null, messages: [] });
  });

  it("devolve 503 acionável quando o modelo falha, sem detalhes técnicos", async () => {
    responder.failWith = new Error("model secret detail");

    const response = await request(app.getHttpServer())
      .post("/api/v1/conversations/messages")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ expertId: "cfo", prompt: "How is our runway?" })
      .expect(503);

    expect(response.body).toEqual({
      code: "MODEL_UNAVAILABLE",
      message: "The Expert could not respond right now. Try again in a moment.",
    });
    expect(JSON.stringify(response.body)).not.toContain("model secret detail");
    responder.failWith = null;
  });
});
