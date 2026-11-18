import { Inject, Injectable } from "@nestjs/common";

import { SourcesRepositoryPort } from "./ports/sources-repository.port";
import { VectorStorePort } from "./ports/vector-store.port";
import { WebPageFetcherPort } from "./ports/web-page-fetcher.port";
import { ProcessSourceVersionUseCase } from "./process-source-version.use-case";
import { sha256Hex } from "../domain/source-file-policy";
import { URL_SOURCE_MIME_TYPE } from "../domain/source-url-policy";
import { SourceVersionNotFoundError } from "../domain/source.errors";

export type RetrySourceVersionResult = {
  sourceId: string;
  versionId: string;
  status: "processing";
};

/** Retries a failed version after clearing any partial vector write. */
@Injectable()
export class RetrySourceVersionUseCase {
  constructor(
    @Inject(SourcesRepositoryPort)
    private readonly sources: SourcesRepositoryPort,
    @Inject(VectorStorePort) private readonly vectors: VectorStorePort,
    @Inject(ProcessSourceVersionUseCase)
    private readonly processVersion: ProcessSourceVersionUseCase,
    @Inject(WebPageFetcherPort)
    private readonly fetcher: WebPageFetcherPort,
  ) {}

  async execute(
    userId: string,
    versionId: string,
  ): Promise<RetrySourceVersionResult> {
    const version = await this.sources.findVersion(userId, versionId);

    if (version === null || version.status !== "failed") {
      throw new SourceVersionNotFoundError();
    }

    await this.vectors.deleteVersion(userId, versionId);

    if (version.mimeType === URL_SOURCE_MIME_TYPE) {
      // A fetch failure left no stored bytes, so the page must be loaded again.
      const page = await this.fetcher.fetch(version.originalName);
      const buffer = Buffer.from(page.text, "utf8");

      await this.sources.updateVersionContentHash(
        userId,
        versionId,
        sha256Hex(buffer),
        buffer.byteLength,
      );
      await this.sources.saveFile(userId, versionId, buffer);
    }

    await this.sources.updateVersionStatus(
      userId,
      versionId,
      "processing",
      undefined,
      null,
    );
    await this.processVersion.execute({ userId, versionId });

    return {
      sourceId: version.sourceId,
      versionId,
      status: "processing",
    };
  }
}
