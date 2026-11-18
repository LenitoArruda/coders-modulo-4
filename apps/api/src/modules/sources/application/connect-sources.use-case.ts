import { Inject, Injectable } from "@nestjs/common";

import { log } from "../../shared/observability/app-logger";
import { SourcesRepositoryPort } from "./ports/sources-repository.port";
import { ProcessSourceVersionUseCase } from "./process-source-version.use-case";
import type { SourceStatus, SourceType } from "../domain/source";
import type { ValidatedSourceFile } from "../domain/source-file-policy";
import { SourceProcessingError } from "../domain/source.errors";

export type ConnectSourcesInput = {
  userId: string;
  files: ValidatedSourceFile[];
};

export type ConnectedSourceResult = {
  name: string;
  type: SourceType;
  byteSize: number;
  sourceId: string;
  versionId: string;
  status: SourceStatus;
  alreadyConnected: boolean;
};

export type ConnectSourcesResult = {
  results: ConnectedSourceResult[];
};

/** Registers connections and starts indexing in the background. */
@Injectable()
export class ConnectSourcesUseCase {
  constructor(
    @Inject(SourcesRepositoryPort)
    private readonly sources: SourcesRepositoryPort,
    @Inject(ProcessSourceVersionUseCase)
    private readonly processVersion: ProcessSourceVersionUseCase,
  ) {}

  async execute(input: ConnectSourcesInput): Promise<ConnectSourcesResult> {
    const results: ConnectedSourceResult[] = [];

    for (const file of input.files) {
      const existing = await this.sources.findVersionByHash(
        input.userId,
        file.contentHash,
      );

      if (existing !== null) {
        log("info", "knowledge.sources", {
          event: "source.deduplicated",
          outcome: "ok",
          userId: input.userId,
          sourceId: existing.sourceId,
          versionId: existing.id,
        });

        results.push({
          name: file.originalName,
          type: file.type,
          byteSize: file.byteSize,
          sourceId: existing.sourceId,
          versionId: existing.id,
          status: existing.status,
          alreadyConnected: true,
        });
        continue;
      }

      const existingSource = await this.sources.findSourceByNormalizedName(
        input.userId,
        file.normalizedName,
      );
      const source =
        existingSource ??
        (await this.sources.createSource(
          input.userId,
          file.originalName,
          file.normalizedName,
          file.type,
        ));
      const version = await this.sources.createVersion({
        userId: input.userId,
        sourceId: source.id,
        contentHash: file.contentHash,
        originalName: file.originalName,
        mimeType: file.mimeType,
        byteSize: file.byteSize,
        type: file.type,
        status: "processing",
      });

      if (version === null) {
        const concurrent = await this.sources.findVersionByHash(
          input.userId,
          file.contentHash,
        );

        if (concurrent === null) throw new SourceProcessingError();

        results.push({
          name: file.originalName,
          type: file.type,
          byteSize: file.byteSize,
          sourceId: concurrent.sourceId,
          versionId: concurrent.id,
          status: concurrent.status,
          alreadyConnected: true,
        });
        continue;
      }

      await this.sources.saveFile(input.userId, version.id, file.buffer);

      // The HTTP response is deliberately sent before indexing completes.
      void this.processVersion
        .execute({ userId: input.userId, versionId: version.id })
        .catch(() => {});

      log("info", "knowledge.sources", {
        event: "source.submitted",
        outcome: "accepted",
        userId: input.userId,
        sourceId: source.id,
        versionId: version.id,
      });

      results.push({
        name: file.originalName,
        type: file.type,
        byteSize: file.byteSize,
        sourceId: source.id,
        versionId: version.id,
        status: "processing",
        alreadyConnected: false,
      });
    }

    return { results };
  }
}
