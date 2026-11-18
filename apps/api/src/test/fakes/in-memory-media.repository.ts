import { randomUUID } from "node:crypto";

import type {
  MediaAttachment,
  MediaErrorCode,
} from "../../modules/media/domain/media";
import {
  MediaGenerationRepositoryPort,
  type MediaGenerationRecord,
  type MediaTerminalUpdate,
  type NewMediaGeneration,
} from "../../modules/media/application/ports/media-generation-repository.port";

/** In-memory media persistence used by unit and integration tests. */
export class InMemoryMediaRepository extends MediaGenerationRepositoryPort {
  readonly records: MediaGenerationRecord[] = [];

  async create(input: NewMediaGeneration): Promise<MediaGenerationRecord> {
    const now = new Date();
    const record: MediaGenerationRecord = {
      id: input.id,
      userId: input.userId,
      conversationId: null,
      messageId: null,
      kind: input.kind,
      status: "queued",
      mimeType: null,
      fileName: input.fileName,
      byteSize: null,
      content: null,
      width: null,
      height: null,
      durationSeconds: null,
      modelId: input.modelId,
      modelVersion: null,
      providerPrompt: input.providerPrompt,
      parameters: input.parameters,
      citation: input.citation,
      errorCode: null,
      errorMessage: null,
      estimatedCostUsd: null,
      latencyMs: null,
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.records.push(record);

    return record;
  }

  async findById(
    mediaId: string,
    userId: string,
  ): Promise<MediaGenerationRecord | null> {
    return (
      this.records.find(
        (record) => record.id === mediaId && record.userId === userId,
      ) ?? null
    );
  }

  async claim(
    mediaId: string,
    userId: string,
    attempts: number,
  ): Promise<boolean> {
    const record = await this.findById(mediaId, userId);

    if (record === null || record.status !== "queued") return false;

    record.status = "generating";
    record.attempts = attempts;
    record.updatedAt = new Date();

    return true;
  }

  async markReady(
    mediaId: string,
    userId: string,
    update: MediaTerminalUpdate,
  ): Promise<MediaGenerationRecord | null> {
    const record = await this.findById(mediaId, userId);

    if (record === null) return null;

    record.status = "ready";
    record.content = update.bytes;
    record.byteSize = update.bytes.byteLength;
    record.mimeType = update.mimeType;
    record.width = update.width;
    record.height = update.height;
    record.modelId = update.modelId;
    record.modelVersion = update.modelVersion;
    record.estimatedCostUsd = update.estimatedCostUsd;
    record.durationSeconds = update.durationSeconds;
    record.errorCode = null;
    record.errorMessage = null;
    record.latencyMs = Date.now() - record.createdAt.getTime();
    record.updatedAt = new Date();

    return record;
  }

  async markFailed(
    mediaId: string,
    userId: string,
    errorCode: MediaErrorCode,
    message: string,
  ): Promise<MediaGenerationRecord | null> {
    const record = await this.findById(mediaId, userId);

    if (record === null) return null;

    record.status = "failed";
    record.content = null;
    record.byteSize = null;
    record.mimeType = null;
    record.errorCode = errorCode;
    record.errorMessage = message;
    record.updatedAt = new Date();

    return record;
  }

  async markCancelled(
    mediaId: string,
    userId: string,
  ): Promise<MediaGenerationRecord | null> {
    const record = await this.findById(mediaId, userId);

    if (record === null) return null;

    record.status = "cancelled";
    record.content = null;
    record.byteSize = null;
    record.mimeType = null;
    record.updatedAt = new Date();

    return record;
  }

  async requeue(
    mediaId: string,
    userId: string,
  ): Promise<MediaGenerationRecord | null> {
    const record = await this.findById(mediaId, userId);

    if (record === null) return null;

    record.status = "queued";
    record.attempts = Math.min(3, record.attempts + 1);
    record.errorCode = null;
    record.errorMessage = null;
    record.content = null;
    record.byteSize = null;
    record.mimeType = null;
    record.updatedAt = new Date();

    return record;
  }

  async linkMessage(
    mediaId: string,
    messageId: string,
    conversationId: string,
    userId: string,
  ): Promise<void> {
    const record = await this.findById(mediaId, userId);

    if (record === null) return;

    record.messageId = messageId;
    record.conversationId = conversationId;
  }

  toAttachment(record: MediaGenerationRecord): MediaAttachment {
    return {
      mediaId: record.id,
      kind: record.kind,
      status: record.status,
      uri: `/api/v1/media/${record.id}/content`,
      mimeType: record.mimeType,
      sizeBytes: record.byteSize,
      width: record.width,
      height: record.height,
      durationSeconds: record.durationSeconds,
      modelId: record.modelId,
      modelVersion: record.modelVersion,
      parameters: record.parameters,
      createdAt: record.createdAt.toISOString(),
      ...(record.citation === null ? {} : { citation: record.citation }),
      ...(record.errorCode === null ? {} : { errorCode: record.errorCode }),
      ...(record.errorMessage === null
        ? {}
        : { errorMessage: record.errorMessage }),
      attempts: record.attempts,
    };
  }
}

/** Convenience for tests that need a ready attachment without a provider. */
export function seedReadyMedia(
  repository: InMemoryMediaRepository,
  userId: string,
  kind: "image" | "video" = "image",
): Promise<MediaGenerationRecord> {
  const id = randomUUID();

  return repository.create({
    id,
    userId,
    kind,
    fileName: `${kind}-${id}.${kind === "image" ? "png" : "mp4"}`,
    modelId: kind === "image" ? "gpt-image-2" : "gemini-omni-1.2-flash",
    providerPrompt: "test prompt",
    parameters: { kind },
    citation: null,
  });
}
