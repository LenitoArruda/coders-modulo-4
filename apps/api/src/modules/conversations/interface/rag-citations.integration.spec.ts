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
import { CitationSourceMetadataPort } from "../../citations/application/ports/citation-source-metadata.port";
import { KnowledgeRetrievalPort } from "../../citations/application/ports/knowledge-retrieval.port";
import { QueryEmbeddingPort } from "../../citations/application/ports/query-embedding.port";
import type { VectorHit } from "../../citations/application/ports/knowledge-retrieval.port";
import { RAG_CITATIONS_ENABLED } from "../../citations/citations.tokens";
import { ConversationsRepositoryPort } from "../application/ports/conversations-repository.port";
import { ExpertResponderPort } from "../application/ports/expert-responder.port";

const USER: AuthUser = {
  id: "11111111-1111-1111-1111-111111111111",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
};

class FakeEmbeddings extends QueryEmbeddingPort {
  async embedQuery(): Promise<number[]> {
    return [0.1, 0.2];
  }
}

class FakeRetrieval extends KnowledgeRetrievalPort {
  hits: VectorHit[] = [
    {
      chunkId: "chunk-1",
      sourceId: "source-1",
      sourceVersionId: "version-1",
      chunkIndex: 0,
      content: "Ship in small batches.",
      score: 0.9,
    },
  ];
  fail = false;

  async search(userId: string): Promise<VectorHit[]> {
    if (this.fail) throw new Error("vector store unavailable");

    return userId === USER.id ? this.hits : [];
  }
}

class FakeSources extends CitationSourceMetadataPort {
  isStale = false;

  async load() {
    return new Map([
      [
        "version-1",
        {
          sourceName: "handbook.txt",
          sourceType: "txt",
          isStale: this.isStale,
          sourceRemoved: false,
        },
      ],
    ]);
  }
}

describe("rotas de chat com RAG habilitado", () => {
  let app: INestApplication;
  let sessions: InMemorySessionsRepository;
  let responder: FakeExpertResponder;
  let retrieval: FakeRetrieval;
  let sources: FakeSources;
  let token: string;

  beforeAll(async () => {
    const users = new InMemoryUsersRepository();
    users.seed(USER);

    sessions = new InMemorySessionsRepository();
    responder = new FakeExpertResponder();
    retrieval = new FakeRetrieval();
    sources = new FakeSources();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SessionsRepositoryPort)
      .useValue(sessions)
      .overrideProvider(UsersRepositoryPort)
      .useValue(users)
      .overrideProvider(EmailSenderPort)
      .useValue(new InMemoryEmailSender())
      .overrideProvider(ConversationsRepositoryPort)
      .useValue(new InMemoryConversationsRepository())
      .overrideProvider(ExpertResponderPort)
      .useValue(responder)
      .overrideProvider(RAG_CITATIONS_ENABLED)
      .useValue(true)
      .overrideProvider(QueryEmbeddingPort)
      .useValue(new FakeEmbeddings())
      .overrideProvider(KnowledgeRetrievalPort)
      .useValue(retrieval)
      .overrideProvider(CitationSourceMetadataPort)
      .useValue(sources)
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();

    const session = sessions.seed(activeSession(USER.id));
    const tokens = moduleRef.get(SessionTokenPort);
    token = await tokens.sign({ userId: USER.id, sessionId: session.id });
  });

  afterAll(async () => {
    await app.close();
  });

  it("devolve citações e metadados de recuperação na resposta", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/conversations/messages")
      .set("Authorization", `Bearer ${token}`)
      .send({ expertId: "cto", prompt: "How should we ship?" })
      .expect(201);

    expect(response.body.expertMessage.content).toContain("[1]");
    expect(response.body.expertMessage.citations).toHaveLength(1);
    expect(response.body.expertMessage.citations[0]).toMatchObject({
      citationNumber: 1,
      sourceName: "handbook.txt",
      location: { label: "Chunk 1" },
      isStale: false,
    });
    expect(response.body.expertMessage.retrieval).toMatchObject({
      status: "matched",
      vectorIndex: "KnowledgeChunk",
      queryEmbeddingModel: "text-embedding-3-small",
    });
    expect(response.body.expertMessage.answerStatus).toBe("with_source");
    expect(responder.calls[0]?.grounding?.snippets).toHaveLength(1);
  });

  it("recalcula stale ao reler o histórico", async () => {
    sources.isStale = true;

    const response = await request(app.getHttpServer())
      .get("/api/v1/conversations?expertId=cto")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.messages[1].citations[0].isStale).toBe(true);

    sources.isStale = false;
  });

  it("degrada para aviso acionável quando a busca vetorial falha", async () => {
    retrieval.fail = true;

    const response = await request(app.getHttpServer())
      .post("/api/v1/conversations/messages")
      .set("Authorization", `Bearer ${token}`)
      .send({ expertId: "cfo", prompt: "What is our runway?" })
      .expect(201);

    expect(response.body.expertMessage.answerStatus).toBe(
      "retrieval_unavailable",
    );
    expect(response.body.expertMessage.content).toContain(
      "Knowledge search is unavailable right now",
    );
    expect(response.body.expertMessage.citations).toEqual([]);
    expect(response.body.expertMessage.retrieval.status).toBe("unavailable");

    retrieval.fail = false;
  });

  it("usa resposta sem fonte quando não há match", async () => {
    retrieval.hits = [];

    const response = await request(app.getHttpServer())
      .post("/api/v1/conversations/messages")
      .set("Authorization", `Bearer ${token}`)
      .send({ expertId: "ceo", prompt: "Unrelated question" })
      .expect(201);

    expect(response.body.expertMessage.answerStatus).toBe("no_match");
    expect(response.body.expertMessage.content).toContain(
      "I couldn't find a basis in your connected knowledge",
    );
    expect(response.body.expertMessage.citations).toEqual([]);

    retrieval.hits = [
      {
        chunkId: "chunk-1",
        sourceId: "source-1",
        sourceVersionId: "version-1",
        chunkIndex: 0,
        content: "Ship in small batches.",
        score: 0.9,
      },
    ];
  });
});
