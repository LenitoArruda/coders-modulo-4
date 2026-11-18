import { createHash } from "node:crypto";
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
import { InMemorySourcesRepository } from "../../../test/fakes/in-memory-sources.repository";
import { InMemoryUsersRepository } from "../../../test/fakes/in-memory-users.repository";
import { FakeDocumentTextExtractor } from "../../../test/fakes/fake-document-text-extractor";
import { FakeEmbeddingGenerator } from "../../../test/fakes/fake-embedding-generator";
import {
  InMemoryVectorStore,
  vectorStoreFailure,
} from "../../../test/fakes/in-memory-vector-store";
import { EmailSenderPort } from "../../auth/application/ports/email-sender.port";
import { SessionTokenPort } from "../../auth/application/ports/session-token.port";
import { SessionsRepositoryPort } from "../../auth/application/ports/sessions-repository.port";
import { UsersRepositoryPort } from "../../auth/application/ports/users-repository.port";
import type { AuthUser } from "../../auth/domain/auth-user";
import { DocumentTextExtractorPort } from "../application/ports/document-text-extractor.port";
import { EmbeddingGeneratorPort } from "../application/ports/embedding-generator.port";
import { SourcesRepositoryPort } from "../application/ports/sources-repository.port";
import { VectorStorePort } from "../application/ports/vector-store.port";

const USER: AuthUser = {
  id: "11111111-1111-1111-1111-111111111111",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
};

async function settle(): Promise<void> {
  for (let index = 0; index < 20; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

describe("rotas de fontes de conhecimento", () => {
  let app: INestApplication;
  let sources: InMemorySourcesRepository;
  let vectors: InMemoryVectorStore;
  let token: string;

  beforeAll(async () => {
    const users = new InMemoryUsersRepository();
    users.seed(USER);
    const sessions = new InMemorySessionsRepository();
    sources = new InMemorySourcesRepository();
    vectors = new InMemoryVectorStore();
    const session = sessions.seed(activeSession(USER.id));

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(UsersRepositoryPort)
      .useValue(users)
      .overrideProvider(SessionsRepositoryPort)
      .useValue(sessions)
      .overrideProvider(EmailSenderPort)
      .useValue(new InMemoryEmailSender())
      .overrideProvider(SourcesRepositoryPort)
      .useValue(sources)
      .overrideProvider(DocumentTextExtractorPort)
      .useValue(new FakeDocumentTextExtractor())
      .overrideProvider(EmbeddingGeneratorPort)
      .useValue(new FakeEmbeddingGenerator())
      .overrideProvider(VectorStorePort)
      .useValue(vectors)
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    token = await moduleRef
      .get(SessionTokenPort)
      .sign({ userId: USER.id, sessionId: session.id });
  });

  afterAll(async () => {
    await app.close();
  });

  it("exige sessão em todas as rotas de fontes", async () => {
    await request(app.getHttpServer()).get("/api/v1/sources").expect(401);
    await request(app.getHttpServer()).post("/api/v1/sources").expect(401);
    await request(app.getHttpServer())
      .delete("/api/v1/sources/any")
      .expect(401);
  });

  it("envia TXT, acompanha o status e lista a fonte pronta", async () => {
    sources.sources.length = 0;
    sources.versions.length = 0;
    sources.files.length = 0;
    sources.chunks.length = 0;
    vectors.records.length = 0;

    const sent = await request(app.getHttpServer())
      .post("/api/v1/sources")
      .set("Authorization", `Bearer ${token}`)
      .attach("files", Buffer.from("contexto explícito"), {
        filename: "notes.txt",
        contentType: "text/plain",
      })
      .expect(202);

    expect(sent.body.results[0]).toMatchObject({
      status: "processing",
      alreadyConnected: false,
    });

    await settle();

    const listed = await request(app.getHttpServer())
      .get("/api/v1/sources")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(listed.body.sources).toHaveLength(1);
    expect(listed.body.sources[0]).toMatchObject({
      name: "notes.txt",
      type: "txt",
      byteSize: Buffer.byteLength("contexto explícito", "utf8"),
      status: "ready",
      chunkCount: 1,
      versionNumber: 1,
    });
    expect(vectors.records).toHaveLength(1);
  });

  it("informa Already connected sem duplicar versão, chunk ou vetor", async () => {
    const before = {
      versions: sources.versions.length,
      chunks: sources.chunks.length,
      vectors: vectors.records.length,
    };
    const versionId = sources.versions[0]?.id;

    const sent = await request(app.getHttpServer())
      .post("/api/v1/sources")
      .set("Authorization", `Bearer ${token}`)
      .attach("files", Buffer.from("contexto explícito"), {
        filename: "copy.txt",
        contentType: "text/plain",
      })
      .expect(202);

    await settle();

    expect(sent.body.results[0]).toMatchObject({
      alreadyConnected: true,
      versionId,
    });
    expect(sources.versions).toHaveLength(before.versions);
    expect(sources.chunks).toHaveLength(before.chunks);
    expect(vectors.records).toHaveLength(before.vectors);
  });

  it("rejeita tipo não suportado com mensagem em inglês", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/sources")
      .set("Authorization", `Bearer ${token}`)
      .attach("files", Buffer.from("binary"), {
        filename: "malware.exe",
        contentType: "application/octet-stream",
      })
      .expect(400);

    expect(response.body.code).toBe("UNSUPPORTED_SOURCE_FILE");
    expect(response.body.message).toContain("PDF, TXT or Markdown");
  });

  it("marca falha de vetor, permite retry e exclui a fonte por completo", async () => {
    vectors.failure = vectorStoreFailure();

    const sent = await request(app.getHttpServer())
      .post("/api/v1/sources")
      .set("Authorization", `Bearer ${token}`)
      .attach("files", Buffer.from("conteúdo para retry"), {
        filename: "retry.txt",
        contentType: "text/plain",
      })
      .expect(202);
    await settle();

    const failedVersion = sources.versions.find(
      (version) => version.id === sent.body.results[0]?.versionId,
    );
    expect(failedVersion?.status).toBe("failed");

    vectors.failure = null;
    await request(app.getHttpServer())
      .post(`/api/v1/sources/${failedVersion?.id}/retry`)
      .set("Authorization", `Bearer ${token}`)
      .expect(202);
    await settle();

    expect(failedVersion?.status).toBe("ready");

    const sourceId = failedVersion?.sourceId ?? "";
    await request(app.getHttpServer())
      .delete(`/api/v1/sources/${sourceId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);

    expect(sources.sources.some((source) => source.id === sourceId)).toBe(
      false,
    );
    expect(
      sources.versions.some((version) => version.sourceId === sourceId),
    ).toBe(false);
    expect(vectors.deletedSources).toContain(sourceId);
    await request(app.getHttpServer())
      .get("/api/v1/sources")
      .set("Authorization", `Bearer ${token}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.sources).toHaveLength(1);
      });
  });

  it("aceita dois envios simultâneos do mesmo conteúdo sem duplicar vetores", async () => {
    const before = vectors.records.length;
    const content = Buffer.from("conteúdo simultâneo");
    const options = {
      filename: "simultaneo.txt",
      contentType: "text/plain",
    };

    await Promise.all([
      request(app.getHttpServer())
        .post("/api/v1/sources")
        .set("Authorization", `Bearer ${token}`)
        .attach("files", content, options)
        .expect(202),
      request(app.getHttpServer())
        .post("/api/v1/sources")
        .set("Authorization", `Bearer ${token}`)
        .attach("files", content, options)
        .expect(202),
    ]);
    await settle();

    const contentHash = createHash("sha256").update(content).digest("hex");
    const validVersions = sources.versions.filter(
      (version) => version.contentHash === contentHash,
    );

    expect(validVersions).toHaveLength(1);
    expect(vectors.records.length).toBe(before + 1);
  });
});
