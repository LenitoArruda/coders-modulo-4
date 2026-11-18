import { Injectable } from "@nestjs/common";

import { log } from "../../shared/observability/app-logger";
import { MEDIA_MESSAGES, type MediaAttachment } from "../domain/media";
import { MediaNotFoundError } from "../domain/media.errors";

import { MediaGenerationRepositoryPort } from "./ports/media-generation-repository.port";
import { MediaJobQueuePort } from "./ports/media-job-queue.port";

/** Cancels a job and discards any partial result. */
@Injectable()
export class CancelMediaGenerationUseCase {
  constructor(
    private readonly repository: MediaGenerationRepositoryPort,
    private readonly queue: MediaJobQueuePort,
  ) {}

  async execute(mediaId: string, userId: string): Promise<MediaAttachment> {
    const current = await this.repository.findById(mediaId, userId);

    if (current === null) throw new MediaNotFoundError();

    const refunded = await this.queue.cancel(mediaId);
    const cancelled = await this.repository.markCancelled(mediaId, userId);

    if (cancelled === null) throw new MediaNotFoundError();

    log("info", "media_generation.cancelled", {
      event: "media_generation.cancelled",
      mediaId,
      userId,
      kind: current.kind,
      quotaRefunded: refunded,
      outcome: "cancelled",
    });

    return this.repository.toAttachment({
      ...cancelled,
      errorCode: "CANCELLED",
      errorMessage: MEDIA_MESSAGES.cancelled,
    });
  }
}
