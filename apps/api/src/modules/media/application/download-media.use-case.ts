import { Injectable } from "@nestjs/common";

import { log } from "../../shared/observability/app-logger";
import { MediaNotFoundError } from "../domain/media.errors";

import { MediaGenerationRepositoryPort } from "./ports/media-generation-repository.port";

export type MediaDownload = {
  bytes: Buffer;
  mimeType: string;
  fileName: string;
};

/** Resolves bytes only for a ready file owned by the authenticated user. */
@Injectable()
export class DownloadMediaUseCase {
  constructor(private readonly repository: MediaGenerationRepositoryPort) {}

  async execute(mediaId: string, userId: string): Promise<MediaDownload> {
    const record = await this.repository.findById(mediaId, userId);

    if (
      record === null ||
      record.status !== "ready" ||
      record.content === null ||
      record.mimeType === null
    ) {
      throw new MediaNotFoundError();
    }

    log("info", "media_generation.downloaded", {
      event: "media_generation.downloaded",
      mediaId,
      userId,
      kind: record.kind,
      outcome: "ok",
    });

    return {
      bytes: record.content,
      mimeType: record.mimeType,
      fileName: record.fileName,
    };
  }
}
