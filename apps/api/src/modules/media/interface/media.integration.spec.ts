import { randomUUID } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../../../app.module";
import { configureApp } from "../../../app-setup";
import { InMemoryEmailSender } from "../../../test/fakes/in-memory-email.sender";
import { InMemoryConversationsRepository } from "../../../test/fakes/in-memory-conversations.repository";
import { InMemoryMediaRepository } from "../../../test/fakes/in-memory-media.repository";
import {
  activeSession,
  InMemorySessionsRepository,
} from "../../../test/fakes/in-memory-sessions.repository";
import { InMemoryUsersRepository } from "../../../test/fakes/in-memory-users.repository";
import { FakeExpertResponder } from "../../../test/fakes/fake-expert-responder";
import { EmailSenderPort } from "../../auth/application/ports/email-sender.port";
import { SessionTokenPort } from "../../auth/application/ports/session-token.port";
import { SessionsRepositoryPort } from "../../auth/application/ports/sessions-repository.port";
import { UsersRepositoryPort } from "../../auth/application/ports/users-repository.port";
import type { AuthUser } from "../../auth/domain/auth-user";
import { ConversationsRepositoryPort } from "../../conversations/application/ports/conversations-repository.port";
import { ExpertResponderPort } from "../../conversations/application/ports/expert-responder.port";
import { MediaGenerationRepositoryPort } from "../application/ports/media-generation-repository.port";
import {
  MediaGeneratorPort,
  type MediaGenerationRequest,
} from "../application/ports/media-generator.port";
import { MediaJobQueuePort } from "../application/ports/media-job-queue.port";
import type { MediaGeneratorResult } from "../domain/media";
import { MEDIA_ENABLED } from "../media.tokens";

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

class FakeMediaGenerator extends MediaGeneratorPort {
  async generate(
    _request: MediaGenerationRequest,
  ): Promise<MediaGeneratorResult> {
    return {
      bytes: Buffer.from("fake-generated-file"),
      mimeType: "image/png",
      width: 1024,
      height: 1024,
      modelId: "fake-model",
      modelVersion: "1",
      estimatedCostUsd: 0,
    };
  }
}

async function buildApp(enabled: boolean) {
  const users = new InMemoryUsersRepository();
  users.seed(userA);
  users.seed(userB);
  const sessions = new InMemorySessionsRepository();
  const conversations = new InMemoryConversationsRepository();
  const media = new InMemoryMediaRepository();
  const responder = new FakeExpertResponder();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(UsersRepositoryPort)
    .useValue(users)
    .overrideProvider(SessionsRepositoryPort)
    .useValue(sessions)
    .overrideProvider(EmailSenderPort)
    .useValue(new InMemoryEmailSender())
    .overrideProvider(ConversationsRepositoryPort)
    .useValue(conversations)
    .overrideProvider(ExpertResponderPort)
    .useValue(responder)
    .overrideProvider(MediaGenerationRepositoryPort)
    .useValue(media)
    .overrideProvider(MediaGeneratorPort)
    .useValue(new FakeMediaGenerator())
    .overrideProvider(MEDIA_ENABLED)
    .useValue(enabled)
    .compile();

  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();

  const tokens = moduleRef.get(SessionTokenPort);
  const sessionA = sessions.seed(activeSession(userA.id));
  const sessionB = sessions.seed(activeSession(userB.id));
  const tokenA = await tokens.sign({
    userId: userA.id,
    sessionId: sessionA.id,
  });
  const tokenB = await tokens.sign({
    userId: userB.id,
    sessionId: sessionB.id,
  });
  const queue = moduleRef.get<MediaJobQueuePort>(MediaJobQueuePort);

  return {
    app,
    media,
    responder,
    queue,
    headersA: { Authorization: `Bearer ${tokenA}` },
    headersB: { Authorization: `Bearer ${tokenB}` },
  };
}

describe("media deliverables API (spec 017)", () => {
  describe("flag enabled", () => {
    let ctx: Awaited<ReturnType<typeof buildApp>>;

    beforeAll(async () => {
      ctx = await buildApp(true);
    });

    afterAll(async () => {
      await ctx.app.close();
    });

    it("creates a media attachment without calling the Expert model", async () => {
      const response = await request(ctx.app.getHttpServer())
        .post("/api/v1/conversations/messages")
        .set(ctx.headersA)
        .send({
          expertId: "cmo",
          prompt: "Create a square image about the new product launch",
          source: "typed",
        })
        .expect(201);

      expect(ctx.responder.calls).toHaveLength(0);
      expect(response.body.expertMessage.media).toHaveLength(1);
      const attachment = response.body.expertMessage.media[0];
      expect(attachment.status).toBe("queued");
      expect(attachment.uri).toMatch(/^\/api\/v1\/media\/[^/]+\/content$/);

      await (ctx.queue as { idle?: () => Promise<void> }).idle?.();

      const status = await request(ctx.app.getHttpServer())
        .get(`/api/v1/media/${attachment.mediaId}/status`)
        .set(ctx.headersA)
        .expect(200);
      expect(status.body.status).toBe("ready");
      expect(status.body.mimeType).toBe("image/png");
      expect(status.body.sizeBytes).toBe(
        Buffer.byteLength("fake-generated-file"),
      );

      const download = await request(ctx.app.getHttpServer())
        .get(`/api/v1/media/${attachment.mediaId}/content`)
        .set(ctx.headersA)
        .expect(200);
      expect(download.body.toString()).toBe("fake-generated-file");
      expect(download.headers["content-type"]).toMatch(/image\/png/);
      expect(download.headers["cache-control"]).toBe("private, no-store");
    });

    it("isolates status and bytes by authenticated user", async () => {
      const mediaId = ctx.media.records[0]?.id;
      expect(mediaId).toBeDefined();

      await request(ctx.app.getHttpServer())
        .get(`/api/v1/media/${mediaId}/status`)
        .set(ctx.headersB)
        .expect(404);
      await request(ctx.app.getHttpServer())
        .get(`/api/v1/media/${mediaId}/content`)
        .set(ctx.headersB)
        .expect(404);
    });

    it("answers one clarification question without creating a job", async () => {
      const before = ctx.media.records.length;
      const response = await request(ctx.app.getHttpServer())
        .post("/api/v1/conversations/messages")
        .set(ctx.headersA)
        .send({
          expertId: "cmo",
          prompt: "Create something about the new product launch",
          source: "typed",
        })
        .expect(201);

      expect(response.body.expertMessage.content).toBe(
        "What should I create — an image or a short video?",
      );
      expect(ctx.media.records).toHaveLength(before);
      expect(ctx.responder.calls).toHaveLength(0);
    });

    it("requires an authenticated session for every media route", async () => {
      await request(ctx.app.getHttpServer())
        .get(`/api/v1/media/${ctx.media.records[0]?.id}/status`)
        .expect(401);
      await request(ctx.app.getHttpServer())
        .post(`/api/v1/media/${ctx.media.records[0]?.id}/retry`)
        .expect(401);
    });

    it("cancels a queued job and retries a failed one", async () => {
      const id = randomUUID();
      await ctx.media.create({
        id,
        userId: userA.id,
        kind: "image",
        fileName: `image-${id}.png`,
        modelId: "gpt-image-2",
        providerPrompt: "Create an image about the campaign",
        parameters: { kind: "image", size: "1024x1024" },
        citation: null,
      });
      await ctx.media.markFailed(
        id,
        userA.id,
        "PROVIDER_UNAVAILABLE",
        "failed",
      );

      const retried = await request(ctx.app.getHttpServer())
        .post(`/api/v1/media/${id}/retry`)
        .set(ctx.headersA)
        .expect(201);
      expect(retried.body.status).toBe("queued");

      const cancelled = await request(ctx.app.getHttpServer())
        .post(`/api/v1/media/${id}/cancel`)
        .set(ctx.headersA)
        .expect(201);
      expect(cancelled.body.status).toBe("cancelled");
      await (ctx.queue as { idle?: () => Promise<void> }).idle?.();
    });
  });

  describe("flag disabled", () => {
    let app: INestApplication;
    let headers: Record<string, string>;

    beforeAll(async () => {
      const ctx = await buildApp(false);
      app = ctx.app;
      headers = ctx.headersA;
    });

    afterAll(async () => {
      await app.close();
    });

    it("hides media routes and keeps regular Expert chat working", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/media/11111111-1111-4111-8111-111111111111/status")
        .set(headers)
        .expect(404);

      const response = await request(app.getHttpServer())
        .post("/api/v1/conversations/messages")
        .set(headers)
        .send({
          expertId: "cmo",
          prompt: "Create an image about the launch",
          source: "typed",
        })
        .expect(201);
      expect(response.body.expertMessage.media).toBeUndefined();
    });
  });
});
