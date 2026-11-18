import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../../../app.module";
import { configureApp } from "../../../app-setup";
import { InMemoryEmailSender } from "../../../test/fakes/in-memory-email.sender";
import { FakeMediaTextExtractor } from "../../../test/fakes/fake-media-text-extractor";
import {
  activeSession,
  InMemorySessionsRepository,
} from "../../../test/fakes/in-memory-sessions.repository";
import { InMemorySourcesRepository } from "../../../test/fakes/in-memory-sources.repository";
import { InMemoryUsersRepository } from "../../../test/fakes/in-memory-users.repository";
import { FakeDocumentTextExtractor } from "../../../test/fakes/fake-document-text-extractor";
import { FakeEmbeddingGenerator } from "../../../test/fakes/fake-embedding-generator";
import { InMemoryVectorStore } from "../../../test/fakes/in-memory-vector-store";
import { EmailSenderPort } from "../../auth/application/ports/email-sender.port";
import { SessionTokenPort } from "../../auth/application/ports/session-token.port";
import { SessionsRepositoryPort } from "../../auth/application/ports/sessions-repository.port";
import { UsersRepositoryPort } from "../../auth/application/ports/users-repository.port";
import type { AuthUser } from "../../auth/domain/auth-user";
import { DocumentTextExtractorPort } from "../application/ports/document-text-extractor.port";
import { MediaTextExtractorPort } from "../application/ports/media-text-extractor.port";
import { EmbeddingGeneratorPort } from "../application/ports/embedding-generator.port";
import { SourcesRepositoryPort } from "../application/ports/sources-repository.port";
import { VectorStorePort } from "../application/ports/vector-store.port";
import { SOURCE_MEDIA_ENABLED } from "../sources.tokens";

const USER: AuthUser = {
  id: "11111111-1111-1111-1111-111111111111",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
};

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01,
]);
const MP3 = Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x01, 0x02]);
const SILENT_MP3 = Buffer.from([
  0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x09, 0x09,
]);
const MP4 = Buffer.from([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
]);

async function settle(): Promise<void> {
  for (let index = 0; index < 30; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

type TestContext = {
  app: INestApplication;
  sources: InMemorySourcesRepository;
  vectors: InMemoryVectorStore;
  mediaExtractor: FakeMediaTextExtractor;
  token: string;
};

async function createApp(mediaEnabled: boolean): Promise<TestContext> {
  const users = new InMemoryUsersRepository();
  users.seed(USER);
  const sessions = new InMemorySessionsRepository();
  const sources = new InMemorySourcesRepository();
  const vectors = new InMemoryVectorStore();
  const mediaExtractor = new FakeMediaTextExtractor();
  mediaExtractor.silentNames.add("silent.mp3");
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
    .overrideProvider(MediaTextExtractorPort)
    .useValue(mediaExtractor)
    .overrideProvider(EmbeddingGeneratorPort)
    .useValue(new FakeEmbeddingGenerator())
    .overrideProvider(VectorStorePort)
    .useValue(vectors)
    .overrideProvider(SOURCE_MEDIA_ENABLED)
    .useValue(mediaEnabled)
    .compile();

  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();
  const token = await moduleRef
    .get(SessionTokenPort)
    .sign({ userId: USER.id, sessionId: session.id });

  return { app, sources, vectors, mediaExtractor, token };
}

function attach(
  context: TestContext,
  buffer: Buffer,
  filename: string,
  contentType: string,
) {
  return request(context.app.getHttpServer())
    .post("/api/v1/sources")
    .set("Authorization", `Bearer ${context.token}`)
    .attach("files", buffer, { filename, contentType });
}

describe("rotas de mídia como fonte de conhecimento", () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createApp(true);
  });

  afterAll(async () => {
    await context.app.close();
  });

  it("exige sessão para enviar mídia", async () => {
    await request(context.app.getHttpServer())
      .post("/api/v1/sources")
      .expect(401);
  });

  it("envia PNG, acompanha fases e grava vetores da fonte", async () => {
    const sent = await attach(context, PNG, "manual.png", "image/png").expect(
      202,
    );

    expect(sent.body.results[0]).toMatchObject({
      type: "image",
      status: "processing",
      alreadyConnected: false,
    });

    await settle();

    const version = context.sources.versions.find(
      (candidate) => candidate.id === sent.body.results[0]?.versionId,
    );

    expect(version).toMatchObject({
      status: "ready",
      mediaType: "image",
      extractionMethod: "ocr",
      extractionModelVersion: "fake-local-v1",
      processingPhase: null,
      chunkCount: 1,
    });
    expect(context.vectors.records).toHaveLength(1);

    const listed = await request(context.app.getHttpServer())
      .get("/api/v1/sources")
      .set("Authorization", `Bearer ${context.token}`)
      .expect(200);

    expect(listed.body.sources[0]).toMatchObject({
      type: "image",
      status: "ready",
      mediaType: "image",
      extractionMethod: "ocr",
    });
  });

  it("envia áudio com duração e vídeo com fala", async () => {
    await request(context.app.getHttpServer())
      .post("/api/v1/sources")
      .set("Authorization", `Bearer ${context.token}`)
      .field("durationSeconds", "300")
      .attach("files", MP3, {
        filename: "meeting.mp3",
        contentType: "audio/mpeg",
      })
      .expect(202);
    await settle();

    await attach(context, MP4, "demo.mp4", "video/mp4").expect(202);
    await settle();

    expect(context.vectors.records).toHaveLength(3);
    expect(
      context.sources.versions
        .map((version) => version.type)
        .filter((type) => type === "audio" || type === "video"),
    ).toEqual(["audio", "video"]);
    expect(
      context.sources.versions.find((version) => version.type === "audio")
        ?.durationSeconds,
    ).toBe(300);
  });

  it("rejeita MIME não suportado sem criar fonte", async () => {
    const before = context.sources.sources.length;

    const response = await attach(
      context,
      Buffer.from("MZ"),
      "payload.exe",
      "application/octet-stream",
    ).expect(400);

    expect(response.body.code).toBe("UNSUPPORTED_SOURCE_FILE");
    expect(response.body.message).toContain("MP4");
    expect(context.sources.sources).toHaveLength(before);
  });

  it("recusa duração acima de 60 minutos", async () => {
    const response = await request(context.app.getHttpServer())
      .post("/api/v1/sources")
      .set("Authorization", `Bearer ${context.token}`)
      .field("durationSeconds", "3601")
      .attach("files", MP3, { filename: "long.mp3", contentType: "audio/mpeg" })
      .expect(400);

    expect(response.body.code).toBe("MEDIA_DURATION_TOO_LONG");
  });

  it("marca falha de fala, permite retry no mesmo sourceId e exclui a fonte", async () => {
    const sent = await attach(
      context,
      SILENT_MP3,
      "silent.mp3",
      "audio/mpeg",
    ).expect(202);
    await settle();

    const failed = context.sources.versions.find(
      (version) => version.id === sent.body.results[0]?.versionId,
    );

    expect(failed?.status).toBe("failed");
    expect(failed?.errorMessage).toBe("No speech detected");

    context.mediaExtractor.silentNames.clear();
    await request(context.app.getHttpServer())
      .post(`/api/v1/sources/${failed?.id}/retry`)
      .set("Authorization", `Bearer ${context.token}`)
      .expect(202);
    await settle();

    expect(failed?.status).toBe("ready");

    const sourceId = failed?.sourceId ?? "";
    await request(context.app.getHttpServer())
      .delete(`/api/v1/sources/${sourceId}`)
      .set("Authorization", `Bearer ${context.token}`)
      .expect(204);

    expect(
      context.sources.sources.some((source) => source.id === sourceId),
    ).toBe(false);
    expect(context.vectors.deletedSources).toContain(sourceId);
  });
});

describe("flag de mídia desligada", () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createApp(false);
  });

  afterAll(async () => {
    await context.app.close();
  });

  it("continua recusando mídia e mantém a mensagem da fatia 013", async () => {
    const before = context.sources.sources.length;

    const response = await attach(context, PNG, "foto.png", "image/png").expect(
      400,
    );

    expect(response.body.code).toBe("UNSUPPORTED_SOURCE_FILE");
    expect(response.body.message).toBe(
      "Only PDF, TXT or Markdown files are supported.",
    );
    expect(context.sources.sources).toHaveLength(before);
  });
});
