import { Injectable } from "@nestjs/common";

import {
  MAX_MEDIA_ATTEMPTS,
  nextAttempt,
  type MediaAttachment,
} from "../domain/media";
import { MediaLimitError, MediaNotFoundError } from "../domain/media.errors";

import { MediaGenerationRepositoryPort } from "./ports/media-generation-repository.port";
import { MediaJobQueuePort } from "./ports/media-job-queue.port";
import { MediaQuotaPort } from "./ports/media-quota.port";

/** Reuses the same attachment id and validated parameters, up to 3 attempts. */
@Injectable()
export class RetryMediaGenerationUseCase {
  constructor(
    private readonly repository: MediaGenerationRepositoryPort,
    private readonly queue: MediaJobQueuePort,
    private readonly quota: MediaQuotaPort,
  ) {}

  async execute(mediaId: string, userId: string): Promise<MediaAttachment> {
    const record = await this.repository.findById(mediaId, userId);

    if (record === null) throw new MediaNotFoundError();
    if (record.attempts >= MAX_MEDIA_ATTEMPTS) {
      throw new MediaLimitError(
        "This file reached the retry limit. Send a new request with your briefing.",
      );
    }

    this.quota.consume(userId, record.kind);
    const requeued = await this.repository.requeue(mediaId, userId);

    if (requeued === null) {
      this.quota.refund(userId, record.kind);
      throw new MediaNotFoundError();
    }

    this.queue.enqueue({
      mediaId,
      userId,
      kind: record.kind,
      parameters: record.parameters,
      prompt: record.providerPrompt,
      modelId: record.modelId,
      citation: record.citation,
      attempts: nextAttempt(record.attempts),
    });

    return this.repository.toAttachment(requeued);
  }
}
