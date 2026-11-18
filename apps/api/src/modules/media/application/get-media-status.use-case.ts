import { Injectable } from "@nestjs/common";

import {
  isTerminalStatus,
  MEDIA_MESSAGES,
  type MediaAttachment,
} from "../domain/media";
import { MediaNotFoundError } from "../domain/media.errors";

import { MediaGenerationRepositoryPort } from "./ports/media-generation-repository.port";

/** Returns the public attachment for one media id owned by the authenticated user. */
@Injectable()
export class GetMediaStatusUseCase {
  constructor(private readonly repository: MediaGenerationRepositoryPort) {}

  async execute(mediaId: string, userId: string): Promise<MediaAttachment> {
    const record = await this.repository.findById(mediaId, userId);

    if (record === null) throw new MediaNotFoundError();

    // An in-memory job cannot survive an API restart: surface an actionable
    // state instead of leaving the client polling forever.
    if (!isTerminalStatus(record.status)) {
      const stale = Date.now() - record.createdAt.getTime() > 10 * 60_000;

      if (stale) {
        const failed = await this.repository.markFailed(
          mediaId,
          userId,
          "PROVIDER_UNAVAILABLE",
          MEDIA_MESSAGES.failed,
        );

        return this.repository.toAttachment(failed ?? record);
      }
    }

    return this.repository.toAttachment(record);
  }
}
