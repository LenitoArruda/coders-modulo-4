import { Inject, Injectable } from "@nestjs/common";

import { log } from "../../shared/observability/app-logger";
import { ConnectSourcesUseCase } from "./connect-sources.use-case";
import type { ConnectSourcesResult } from "./connect-sources.use-case";
import { WebPageFetcherPort } from "./ports/web-page-fetcher.port";
import type { FetchedWebPage } from "./ports/web-page-fetcher.port";
import { SourcesRepositoryPort } from "./ports/sources-repository.port";
import { sha256Hex } from "../domain/source-file-policy";
import {
  normalizeSourceUrl,
  titleForUrl,
  URL_SOURCE_MIME_TYPE,
} from "../domain/source-url-policy";
import {
  BlockedSourceUrlError,
  InvalidSourceUrlError,
  SourceError,
  SourceProcessingError,
  SourceUrlUnavailableError,
} from "../domain/source.errors";

export type ConnectSourceUrlInput = {
  userId: string;
  url: string;
};

/** Fetches one public page and reuses the 013 ingestion pipeline. */
@Injectable()
export class ConnectSourceUrlUseCase {
  constructor(
    @Inject(WebPageFetcherPort)
    private readonly fetcher: WebPageFetcherPort,
    @Inject(SourcesRepositoryPort)
    private readonly sources: SourcesRepositoryPort,
    @Inject(ConnectSourcesUseCase)
    private readonly connectSources: ConnectSourcesUseCase,
  ) {}

  async execute(input: ConnectSourceUrlInput): Promise<ConnectSourcesResult> {
    const startedAt = Date.now();
    const url = normalizeSourceUrl(input.url);
    let page: FetchedWebPage;

    try {
      page = await this.fetcher.fetch(url);
    } catch (error) {
      if (
        error instanceof InvalidSourceUrlError ||
        error instanceof BlockedSourceUrlError
      ) {
        throw error;
      }

      const publicError =
        error instanceof SourceError ? error : new SourceUrlUnavailableError();

      return this.persistFailure(input.userId, url, publicError, startedAt);
    }

    const buffer = Buffer.from(page.text, "utf8");
    const result = await this.connectSources.execute({
      userId: input.userId,
      files: [
        {
          originalName: page.url,
          displayName: page.title === "" ? titleForUrl(page.url) : page.title,
          normalizedName: page.url.toLowerCase(),
          mimeType: URL_SOURCE_MIME_TYPE,
          type: "txt",
          contentHash: sha256Hex(buffer),
          byteSize: buffer.byteLength,
          durationSeconds: null,
          buffer,
        },
      ],
    });

    log("info", "knowledge.sources", {
      event: "source.url.submitted",
      outcome: "accepted",
      userId: input.userId,
      durationMs: Date.now() - startedAt,
    });

    return result;
  }

  /** A failed fetch is still visible as a failed SourceVersion and can be retried. */
  private async persistFailure(
    userId: string,
    url: string,
    error: SourceError,
    startedAt: number,
  ): Promise<ConnectSourcesResult> {
    const title = titleForUrl(url);
    const source =
      (await this.sources.findSourceByNormalizedName(
        userId,
        url.toLowerCase(),
      )) ??
      (await this.sources.createSource(
        userId,
        title,
        url.toLowerCase(),
        "txt",
      ));
    const version = await this.sources.createVersion({
      userId,
      sourceId: source.id,
      contentHash: sha256Hex(Buffer.from(`failed:${url.toLowerCase()}`)),
      originalName: url,
      mimeType: URL_SOURCE_MIME_TYPE,
      byteSize: 1,
      type: "txt",
      status: "failed",
      errorMessage: error.message,
    });

    if (version === null) throw new SourceProcessingError();

    if (source.currentVersionId === null) {
      await this.sources.activateVersion(userId, source.id, version.id);
    }

    log("warn", "knowledge.sources", {
      event: "source.url.failed",
      outcome: "failed",
      userId,
      error: error.code,
      durationMs: Date.now() - startedAt,
    });

    return {
      results: [
        {
          name: title,
          url,
          type: "txt",
          byteSize: 1,
          sourceId: source.id,
          versionId: version.id,
          status: "failed",
          alreadyConnected: false,
        },
      ],
    };
  }
}
