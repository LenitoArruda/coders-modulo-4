import { createHash } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

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
import { FakeWebPageFetcher } from "../../../test/fakes/fake-web-page-fetcher";
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
import { WebPageFetcherPort } from "../application/ports/web-page-fetcher.port";
import { SourceUrlNoTextError } from "../domain/source.errors";

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
  let pages: FakeWebPageFetcher;
  let token: string;

  beforeAll(async () => {
    const users = new InMemoryUsersRepository();
    users.seed(USER);
    const sessions = new InMemorySessionsRepository();
    sources = new InMemorySourcesRepository();
    vectors = new InMemoryVectorStore();
    pages = new FakeWebPageFetcher();
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
      .overrideProvider(WebPageFetcherPort)
      .useValue(pages)
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
    await request(app.getHttpServer()).post("/api/v1/sources/urls").expect(401);
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

describe("rotas de fontes por URL", () => {
  let app: INestApplication;
  let sources: InMemorySourcesRepository;
  let vectors: InMemoryVectorStore;
  let pages: FakeWebPageFetcher;
  let token: string;

  const url = "https://docs.example.com/guide";

  function reset(): void {
    sources.sources.length = 0;
    sources.versions.length = 0;
    sources.files.length = 0;
    sources.chunks.length = 0;
    vectors.records.length = 0;
    vectors.deletedSources.length = 0;
    vectors.failure = null;
    pages.pages.clear();
    pages.failures.clear();
    pages.fetched.length = 0;
  }

  function page(text: string, title = "Team Guide"): void {
    pages.pages.set(url, { url, title, text });
  }

  beforeAll(async () => {
    const users = new InMemoryUsersRepository();
    users.seed(USER);
    const sessions = new InMemorySessionsRepository();
    sources = new InMemorySourcesRepository();
    vectors = new InMemoryVectorStore();
    pages = new FakeWebPageFetcher();
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
      .overrideProvider(WebPageFetcherPort)
      .useValue(pages)
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    token = await moduleRef
      .get(SessionTokenPort)
      .sign({ userId: USER.id, sessionId: session.id });
  });

  beforeEach(() => reset());

  afterAll(async () => {
    await app.close();
  });

  function connect(target = url) {
    return request(app.getHttpServer())
      .post("/api/v1/sources/urls")
      .set("Authorization", `Bearer ${token}`)
      .send({ url: target });
  }

  it("indexa uma página pública com título, endereço e chunks", async () => {
    page("Explicit public documentation for the platform team.");
    const sent = await connect().expect(202);

    expect(sent.body.results[0]).toMatchObject({
      name: "Team Guide",
      url,
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
      name: "Team Guide",
      url,
      type: "txt",
      status: "ready",
      chunkCount: 1,
      versionNumber: 1,
    });
    expect(vectors.records).toHaveLength(1);
  });

  it("reaproveita a versão para a mesma URL e para conteúdo idêntico em outra URL", async () => {
    const text = "Identical content served from two public addresses.";
    page(text);
    const first = await connect().expect(202);
    await settle();

    const before = {
      versions: sources.versions.length,
      chunks: sources.chunks.length,
      vectors: vectors.records.length,
    };

    const duplicate = await connect().expect(202);
    expect(duplicate.body.results[0]).toMatchObject({
      alreadyConnected: true,
      versionId: first.body.results[0]?.versionId,
    });

    const otherUrl = "https://mirror.example.com/article";
    pages.pages.set(otherUrl, { url: otherUrl, title: "Mirror", text });
    const mirror = await connect(otherUrl).expect(202);

    expect(mirror.body.results[0]).toMatchObject({ alreadyConnected: true });
    expect(sources.versions).toHaveLength(before.versions);
    expect(sources.chunks).toHaveLength(before.chunks);
    expect(vectors.records).toHaveLength(before.vectors);
  });

  it("cria nova versão quando o conteúdo da mesma URL muda", async () => {
    page("First published version.");
    const first = await connect().expect(202);
    await settle();

    page("Second published version with different decisions.");
    const second = await connect().expect(202);
    await settle();

    expect(second.body.results[0]?.alreadyConnected).toBe(false);
    expect(second.body.results[0]?.versionId).not.toBe(
      first.body.results[0]?.versionId,
    );
    expect(sources.versions).toHaveLength(2);
    expect(vectors.records).toHaveLength(2);

    const listed = await request(app.getHttpServer())
      .get("/api/v1/sources")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(listed.body.sources).toHaveLength(1);
    expect(listed.body.sources[0]).toMatchObject({
      url,
      versionNumber: 2,
      status: "ready",
    });
  });

  it("recusa esquema inválido e endereço interno sem buscar", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/sources/urls")
      .set("Authorization", `Bearer ${token}`)
      .send({ url: "file:///etc/passwd" })
      .expect(400)
      .expect((response) => {
        expect(response.body.code).toBe("INVALID_SOURCE_URL");
      });

    const internal = await connect("http://127.0.0.1:8080/admin").expect(400);

    expect(internal.body.code).toBe("BLOCKED_SOURCE_URL");
    expect(pages.fetched).toHaveLength(1);
    expect(sources.versions).toHaveLength(0);
    expect(vectors.records).toHaveLength(0);
  });

  it("persiste falha sem texto e permite retry com refetch", async () => {
    pages.failures.set(url, new SourceUrlNoTextError());
    const failed = await connect().expect(202);

    expect(failed.body.results[0]).toMatchObject({ status: "failed", url });
    expect(vectors.records).toHaveLength(0);

    const version = sources.versions.find(
      (candidate) => candidate.id === failed.body.results[0]?.versionId,
    );

    expect(version?.status).toBe("failed");
    expect(version?.errorMessage).toContain("no text");

    pages.failures.clear();
    page("Recovered page content after the retry.");
    await request(app.getHttpServer())
      .post(`/api/v1/sources/${version?.id}/retry`)
      .set("Authorization", `Bearer ${token}`)
      .expect(202);
    await settle();

    expect(version?.status).toBe("ready");
    expect(vectors.records).toHaveLength(1);
    expect(pages.fetched).toHaveLength(2);
  });

  it("remove uma fonte de URL com versões, chunks e vetores", async () => {
    page("Content that will be removed with its source.");
    const sent = await connect().expect(202);
    await settle();

    const sourceId = sent.body.results[0]?.sourceId as string;

    await request(app.getHttpServer())
      .delete(`/api/v1/sources/${sourceId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);

    expect(
      sources.versions.some((version) => version.sourceId === sourceId),
    ).toBe(false);
    expect(sources.chunks).toHaveLength(0);
    expect(vectors.deletedSources).toContain(sourceId);
    expect(vectors.records).toHaveLength(0);
  });
});
