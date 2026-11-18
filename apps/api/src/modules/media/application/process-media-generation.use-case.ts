import { Inject, Injectable, Optional } from "@nestjs/common";

import { log } from "../../shared/observability/app-logger";
import { DEFAULT_MEDIA_MAX_FILE_BYTES, MEDIA_MESSAGES } from "../domain/media";
import { MediaError, MediaLimitError } from "../domain/media.errors";
import { MEDIA_MAX_FILE_BYTES } from "../media.tokens";

import type { MediaJob } from "./ports/media-job-queue.port";
import { MediaGenerationRepositoryPort } from "./ports/media-generation-repository.port";
import { MediaGeneratorPort } from "./ports/media-generator.port";

/** Executes one queued job, persisting either the final bytes or a clean failure. */
@Injectable()
export class ProcessMediaGenerationUseCase {
  constructor(
    @Inject(MediaGenerationRepositoryPort)
    private readonly repository: MediaGenerationRepositoryPort,
    @Inject(MediaGeneratorPort)
    private readonly generator: MediaGeneratorPort,
    @Optional()
    @Inject(MEDIA_MAX_FILE_BYTES)
    private readonly maxFileBytes: number = DEFAULT_MEDIA_MAX_FILE_BYTES,
  ) {}

  async execute(job: MediaJob): Promise<void> {
    const startedAt = Date.now();
    const claimed = await this.repository.claim(
      job.mediaId,
      job.userId,
      job.attempts,
    );

    if (!claimed) return;

    log("info", "media_generation.started", {
      event: "media_generation.started",
      mediaId: job.mediaId,
      userId: job.userId,
      kind: job.kind,
      modelId: job.modelId,
      attempt: job.attempts,
    });

    try {
      const result = await this.generator.generate({
        userId: job.userId,
        kind: job.kind,
        prompt: job.prompt,
        parameters: job.parameters,
        modelId: job.modelId,
      });

      if (
        result.bytes.byteLength === 0 ||
        result.bytes.byteLength > this.maxFileBytes
      ) {
        throw new MediaLimitError(MEDIA_MESSAGES.fileTooLarge);
      }

      await this.repository.markReady(job.mediaId, job.userId, {
        ...result,
        status: "ready",
        durationSeconds: job.parameters.durationSeconds ?? null,
      });

      log("info", "media_generation.completed", {
        event: "media_generation.completed",
        mediaId: job.mediaId,
        userId: job.userId,
        kind: job.kind,
        modelId: job.modelId,
        latencyMs: Date.now() - startedAt,
        sizeBytes: result.bytes.byteLength,
        estimatedCostUsd: result.estimatedCostUsd ?? undefined,
        outcome: "ok",
      });
    } catch (error) {
      const known = error instanceof MediaError ? error : null;
      const code = known?.code ?? "PROVIDER_UNAVAILABLE";
      const message = known?.publicMessage ?? MEDIA_MESSAGES.failed;

      await this.repository.markFailed(job.mediaId, job.userId, code, message);

      log("warn", "media_generation.failed", {
        event: "media_generation.failed",
        mediaId: job.mediaId,
        userId: job.userId,
        kind: job.kind,
        modelId: job.modelId,
        latencyMs: Date.now() - startedAt,
        code,
        error: error instanceof Error ? error.name : "unknown",
        outcome: "failed",
      });
    }
  }
}
