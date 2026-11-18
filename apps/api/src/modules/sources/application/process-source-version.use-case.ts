import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";

import { log } from "../../shared/observability/app-logger";
import { SourcesRepositoryPort } from "./ports/sources-repository.port";
import { DocumentTextExtractorPort } from "./ports/document-text-extractor.port";
import { EmbeddingGeneratorPort } from "./ports/embedding-generator.port";
import { VectorStorePort } from "./ports/vector-store.port";
import { chunkText } from "../domain/source-file-policy";
import {
  EmptySourceFileError,
  SourceError,
  SourceProcessingError,
} from "../domain/source.errors";
import type { Chunk } from "../domain/source";

export type ProcessSourceVersionInput = {
  userId: string;
  versionId: string;
};

function chunkId(versionId: string, index: number): string {
  const bytes = createHash("sha256")
    .update(`${versionId}:${index}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString("hex");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Extracts, embeds and stores one version. Failures are persisted as `failed`. */
@Injectable()
export class ProcessSourceVersionUseCase {
  constructor(
    @Inject(SourcesRepositoryPort)
    private readonly sources: SourcesRepositoryPort,
    @Inject(DocumentTextExtractorPort)
    private readonly extractor: DocumentTextExtractorPort,
    @Inject(EmbeddingGeneratorPort)
    private readonly embeddings: EmbeddingGeneratorPort,
    @Inject(VectorStorePort) private readonly vectors: VectorStorePort,
  ) {}

  async execute(input: ProcessSourceVersionInput): Promise<void> {
    const startedAt = Date.now();
    const version = await this.sources.findVersion(
      input.userId,
      input.versionId,
    );

    if (version === null) throw new SourceProcessingError();

    try {
      const file = await this.sources.findFile(input.userId, version.id);

      if (file === null) throw new SourceProcessingError();

      const text = await this.extractor.extract(
        {
          originalName: version.originalName,
          mimeType: version.mimeType,
          buffer: file,
        },
        version.type,
      );
      const texts = chunkText(text);

      if (texts.length === 0) throw new EmptySourceFileError();

      const vectors = await this.embeddings.embed(texts);
      const chunks: Chunk[] = texts.map((content, index) => ({
        id: chunkId(version.id, index),
        sourceId: version.sourceId,
        sourceVersionId: version.id,
        userId: input.userId,
        index,
        content,
      }));
      const records = chunks.map((chunk, index) => ({
        chunk,
        vector: vectors[index] ?? [],
      }));

      await this.vectors.ensureCollection();
      await this.vectors.upsert(input.userId, records);
      await this.sources.saveChunks(chunks);
      await this.sources.updateVersionStatus(
        input.userId,
        version.id,
        "ready",
        chunks.length,
        null,
      );
      await this.sources.activateVersion(
        input.userId,
        version.sourceId,
        version.id,
      );

      log("info", "knowledge.sources", {
        event: "source.indexed",
        outcome: "ok",
        userId: input.userId,
        sourceId: version.sourceId,
        versionId: version.id,
        chunkCount: chunks.length,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      // A partial write must never be visible as a successful version.
      await this.vectors
        .deleteVersion(input.userId, version.id)
        .catch(() => {});
      const publicError =
        error instanceof SourceError ? error : new SourceProcessingError();

      await this.sources.updateVersionStatus(
        input.userId,
        version.id,
        "failed",
        undefined,
        publicError.message,
      );

      log("warn", "knowledge.sources", {
        event: "source.index.failed",
        outcome: "failed",
        userId: input.userId,
        sourceId: version.sourceId,
        versionId: version.id,
        durationMs: Date.now() - startedAt,
        error: error instanceof SourceError ? error.code : "unknown",
      });

      throw publicError;
    }
  }
}
