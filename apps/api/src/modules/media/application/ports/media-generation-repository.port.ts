import type {
  MediaAttachment,
  MediaCitation,
  MediaErrorCode,
  MediaGeneratorResult,
  MediaKind,
  MediaParameters,
  MediaStatus,
} from "../../domain/media";

/** Internal row; `content` never leaves the API process. */
export type MediaGenerationRecord = {
  id: string;
  userId: string;
  conversationId: string | null;
  messageId: string | null;
  kind: MediaKind;
  status: MediaStatus;
  mimeType: string | null;
  fileName: string;
  byteSize: number | null;
  content: Buffer | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  modelId: string;
  modelVersion: string | null;
  providerPrompt: string;
  parameters: MediaParameters;
  citation: MediaCitation | null;
  errorCode: MediaErrorCode | null;
  errorMessage: string | null;
  estimatedCostUsd: number | null;
  latencyMs: number | null;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
};

export type NewMediaGeneration = {
  id: string;
  userId: string;
  kind: MediaKind;
  fileName: string;
  modelId: string;
  providerPrompt: string;
  parameters: MediaParameters;
  citation: MediaCitation | null;
};

export type MediaTerminalUpdate = MediaGeneratorResult & {
  status: "ready";
  durationSeconds: number | null;
};

/**
 * Persistence boundary for generated files. Every method is scoped by user id:
 * another authenticated user can never read, update or download a file.
 */
export abstract class MediaGenerationRepositoryPort {
  abstract create(input: NewMediaGeneration): Promise<MediaGenerationRecord>;

  abstract findById(
    mediaId: string,
    userId: string,
  ): Promise<MediaGenerationRecord | null>;

  /** Claims a queued job; false means it was cancelled or already claimed. */
  abstract claim(
    mediaId: string,
    userId: string,
    attempts: number,
  ): Promise<boolean>;

  abstract markReady(
    mediaId: string,
    userId: string,
    result: MediaTerminalUpdate,
  ): Promise<MediaGenerationRecord | null>;

  abstract markFailed(
    mediaId: string,
    userId: string,
    errorCode: MediaErrorCode,
    message: string,
  ): Promise<MediaGenerationRecord | null>;

  abstract markCancelled(
    mediaId: string,
    userId: string,
  ): Promise<MediaGenerationRecord | null>;

  abstract requeue(
    mediaId: string,
    userId: string,
  ): Promise<MediaGenerationRecord | null>;

  abstract linkMessage(
    mediaId: string,
    messageId: string,
    conversationId: string,
    userId: string,
  ): Promise<void>;

  /** Public metadata only; bytes are exposed by `download` use case. */
  abstract toAttachment(record: MediaGenerationRecord): MediaAttachment;
}
