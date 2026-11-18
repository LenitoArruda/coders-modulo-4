import { beforeEach, describe, expect, it } from "vitest";

import { InMemoryMediaRepository } from "../../../test/fakes/in-memory-media.repository";
import { MEDIA_MESSAGES } from "../domain/media";
import { MediaNotFoundError } from "../domain/media.errors";
import { InMemoryMediaQuota } from "../infrastructure/in-memory-media-quota";

import {
  MediaGeneratorPort,
  type MediaGenerationRequest,
} from "./ports/media-generator.port";
import { MediaJobQueuePort, type MediaJob } from "./ports/media-job-queue.port";
import type { MediaGeneratorResult } from "../domain/media";
import { CancelMediaGenerationUseCase } from "./cancel-media-generation.use-case";
import { DownloadMediaUseCase } from "./download-media.use-case";
import { GetMediaStatusUseCase } from "./get-media-status.use-case";
import { ProcessMediaGenerationUseCase } from "./process-media-generation.use-case";
import { RequestMediaGenerationUseCase } from "./request-media-generation.use-case";
import { RetryMediaGenerationUseCase } from "./retry-media-generation.use-case";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER_USER = "22222222-2222-4222-8222-222222222222";

class FakeGenerator extends MediaGeneratorPort {
  readonly requests: Array<{ prompt: string; kind: string }> = [];

  async generate(
    request: MediaGenerationRequest,
  ): Promise<MediaGeneratorResult> {
    this.requests.push({ prompt: request.prompt, kind: request.kind });

    return {
      bytes: Buffer.from("fake-media-bytes"),
      mimeType: request.kind === "image" ? "image/png" : "video/mp4",
      width: request.kind === "image" ? 1024 : null,
      height: request.kind === "image" ? 1024 : null,
      modelId: "fake-model",
      modelVersion: "1",
      estimatedCostUsd: 0.01,
    };
  }
}

class ManualQueue extends MediaJobQueuePort {
  readonly jobs: Array<{
    mediaId: string;
    userId: string;
    attempts: number;
  }> = [];

  enqueue(job: MediaJob): void {
    this.jobs.push({
      mediaId: job.mediaId,
      userId: job.userId,
      attempts: job.attempts,
    });
  }

  async cancel(_mediaId: string): Promise<boolean> {
    return true;
  }
}

describe("media use cases (spec 017)", () => {
  let repository: InMemoryMediaRepository;
  let quota: InMemoryMediaQuota;
  let queue: ManualQueue;
  let generator: FakeGenerator;
  let request: RequestMediaGenerationUseCase;
  let process: ProcessMediaGenerationUseCase;
  let getStatus: GetMediaStatusUseCase;
  let cancel: CancelMediaGenerationUseCase;
  let retry: RetryMediaGenerationUseCase;
  let download: DownloadMediaUseCase;

  beforeEach(() => {
    repository = new InMemoryMediaRepository();
    quota = new InMemoryMediaQuota(10, 2, 3_600);
    queue = new ManualQueue();
    generator = new FakeGenerator();
    request = new RequestMediaGenerationUseCase(
      repository,
      queue,
      quota,
      "gpt-image-2",
      "gemini-omni-1.2-flash",
    );
    process = new ProcessMediaGenerationUseCase(
      repository,
      generator,
      20 * 1024 * 1024,
    );
    getStatus = new GetMediaStatusUseCase(repository);
    cancel = new CancelMediaGenerationUseCase(repository, queue);
    retry = new RetryMediaGenerationUseCase(repository, queue, quota);
    download = new DownloadMediaUseCase(repository);
  });

  const input = {
    userId: USER,
    expertId: "cmo",
    expertName: "CMO",
    expertTone: "direct",
    prompt: "Create a square minimalist image about the product launch [1]",
    citations: [
      {
        citationNumber: 1,
        sourceId: "source-1",
        sourceVersionId: "version-1",
        chunkIndex: 0,
        sourceName: "Launch brief",
        sourceType: "file",
        location: { label: "launch.pdf" },
        snippet: "Launch date and positioning",
        isStale: false,
        sourceRemoved: false,
      },
    ],
  };

  it("ignores prompts without a media request", async () => {
    expect(
      await request.execute({ ...input, prompt: "What is our Q3 plan?" }),
    ).toEqual({ outcome: "none" });
    expect(queue.jobs).toHaveLength(0);
  });

  it("asks one question without creating a job when the type is missing", async () => {
    const result = await request.execute({
      ...input,
      prompt: "Create something about the launch",
    });

    expect(result).toEqual({
      outcome: "text",
      message: MEDIA_MESSAGES.needsType,
    });
    expect(queue.jobs).toHaveLength(0);
    expect(repository.records).toHaveLength(0);
  });

  it("rejects an over-limit briefing before calling any provider", async () => {
    const result = await request.execute({
      ...input,
      prompt: "Create an 8k ultra hd image about the new product launch",
    });

    expect(result).toEqual({
      outcome: "text",
      message: MEDIA_MESSAGES.imageSize,
    });
    expect(generator.requests).toHaveLength(0);
    expect(queue.jobs).toHaveLength(0);
  });

  it("queues an image with the citation resolved from the last Expert answer", async () => {
    const result = await request.execute(input);

    expect(result.outcome).toBe("queued");
    if (result.outcome !== "queued") return;

    expect(result.attachment.status).toBe("queued");
    expect(result.attachment.citation).toEqual({
      citationNumber: 1,
      sourceName: "Launch brief",
      locationLabel: "launch.pdf",
    });
    expect(result.reply).toContain("1024x1024 image");
    expect(queue.jobs).toHaveLength(1);
    expect(repository.records[0]?.providerPrompt).toContain("Launch brief");
    expect(repository.records[0]?.providerPrompt).not.toContain(
      "Create a square minimalist",
    );
  });

  it("caps jobs at the configured hourly quota", async () => {
    for (let index = 0; index < 10; index += 1) {
      expect((await request.execute(input)).outcome).toBe("queued");
    }

    expect(await request.execute(input)).toEqual({
      outcome: "text",
      message: MEDIA_MESSAGES.quota,
    });
    expect(queue.jobs).toHaveLength(10);
  });

  it("isolates quotas per user", async () => {
    for (let index = 0; index < 10; index += 1) {
      await request.execute(input);
    }

    expect(
      (await request.execute({ ...input, userId: OTHER_USER })).outcome,
    ).toBe("queued");
  });

  it("stores bytes and metadata when a job finishes", async () => {
    const created = await request.execute(input);
    if (created.outcome !== "queued") throw new Error("job was not queued");
    const job = {
      mediaId: created.attachment.mediaId,
      userId: USER,
      kind: "image" as const,
      parameters: created.attachment.parameters,
      prompt: repository.records[0]!.providerPrompt,
      modelId: "gpt-image-2",
      citation: null,
      attempts: 1,
    };

    await process.execute(job);

    const ready = await getStatus.execute(job.mediaId, USER);
    expect(ready.status).toBe("ready");
    expect(ready.mimeType).toBe("image/png");
    expect(ready.sizeBytes).toBe(Buffer.byteLength("fake-media-bytes"));
    expect((await download.execute(job.mediaId, USER)).bytes.toString()).toBe(
      "fake-media-bytes",
    );
    await expect(
      download.execute(job.mediaId, OTHER_USER),
    ).rejects.toBeInstanceOf(MediaNotFoundError);
  });

  it("cancels a queued job and refunds its quota", async () => {
    const created = await request.execute(input);
    if (created.outcome !== "queued") throw new Error("job was not queued");
    const cancelled = await cancel.execute(created.attachment.mediaId, USER);

    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.errorCode).toBe("CANCELLED");
    expect((await request.execute(input)).outcome).toBe("queued");
  });

  it("retries a failed job with the same id up to three attempts", async () => {
    const created = await request.execute(input);
    if (created.outcome !== "queued") throw new Error("job was not queued");
    const id = created.attachment.mediaId;
    await repository.markFailed(
      id,
      USER,
      "PROVIDER_UNAVAILABLE",
      MEDIA_MESSAGES.failed,
    );
    expect((await retry.execute(id, USER)).attempts).toBe(1);

    await repository.markFailed(
      id,
      USER,
      "PROVIDER_UNAVAILABLE",
      MEDIA_MESSAGES.failed,
    );
    expect((await retry.execute(id, USER)).attempts).toBe(2);

    await repository.markFailed(
      id,
      USER,
      "PROVIDER_UNAVAILABLE",
      MEDIA_MESSAGES.failed,
    );
    expect((await retry.execute(id, USER)).attempts).toBe(3);

    await repository.markFailed(
      id,
      USER,
      "PROVIDER_UNAVAILABLE",
      MEDIA_MESSAGES.failed,
    );
    await expect(retry.execute(id, USER)).rejects.toThrow(/retry limit/i);
  });

  it("marks stale in-flight jobs as failed instead of polling forever", async () => {
    const created = await request.execute(input);
    if (created.outcome !== "queued") throw new Error("job was not queued");
    const record = repository.records[0]!;
    record.createdAt = new Date(Date.now() - 11 * 60_000);
    record.status = "generating";

    const status = await getStatus.execute(created.attachment.mediaId, USER);
    expect(status.status).toBe("failed");
    expect(status.errorCode).toBe("PROVIDER_UNAVAILABLE");
  });
});
