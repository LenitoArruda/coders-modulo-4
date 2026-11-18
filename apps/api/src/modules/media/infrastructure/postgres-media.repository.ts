import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";

import { databaseFailure } from "../../auth/infrastructure/database-error";
import { DATABASE_POOL } from "../../shared/database/database.tokens";
import { withDbSpan } from "../../shared/observability/db-span";
import {
  MediaGenerationRepositoryPort,
  type MediaGenerationRecord,
  type MediaTerminalUpdate,
  type NewMediaGeneration,
} from "../application/ports/media-generation-repository.port";
import type {
  MediaAttachment,
  MediaCitation,
  MediaErrorCode,
  MediaKind,
  MediaParameters,
  MediaStatus,
} from "../domain/media";

const COLUMNS = `
  id, user_id, conversation_id, message_id, kind, status, mime_type,
  file_name, byte_size, content, width, height, duration_seconds,
  model_id, model_version, provider_prompt, parameters, citation,
  error_code, error_message, estimated_cost_usd, latency_ms, attempts,
  created_at, updated_at
`;

type MediaRow = {
  id: string;
  user_id: string;
  conversation_id: string | null;
  message_id: string | null;
  kind: MediaKind;
  status: MediaStatus;
  mime_type: string | null;
  file_name: string;
  byte_size: number | null;
  content: Buffer | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  model_id: string;
  model_version: string | null;
  provider_prompt: string;
  parameters: unknown;
  citation: unknown;
  error_code: string | null;
  error_message: string | null;
  estimated_cost_usd: string | null;
  latency_ms: number | null;
  attempts: number;
  created_at: Date;
  updated_at: Date;
};

function readJson(value: unknown): unknown {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  return value;
}

function toRecord(row: MediaRow): MediaGenerationRecord {
  const parameters = readJson(row.parameters);

  return {
    id: row.id,
    userId: row.user_id,
    conversationId: row.conversation_id,
    messageId: row.message_id,
    kind: row.kind,
    status: row.status,
    mimeType: row.mime_type,
    fileName: row.file_name,
    byteSize: row.byte_size,
    content: row.content,
    width: row.width,
    height: row.height,
    durationSeconds: row.duration_seconds,
    modelId: row.model_id,
    modelVersion: row.model_version,
    providerPrompt: row.provider_prompt,
    parameters: (parameters ?? { kind: row.kind }) as MediaParameters,
    citation: (readJson(row.citation) as MediaCitation | null) ?? null,
    errorCode: (row.error_code as MediaErrorCode | null) ?? null,
    errorMessage: row.error_message,
    estimatedCostUsd:
      row.estimated_cost_usd === null ? null : Number(row.estimated_cost_usd),
    latencyMs: row.latency_ms,
    attempts: row.attempts,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** SQL repository; every statement is scoped by the authenticated user id. */
@Injectable()
export class PostgresMediaRepository extends MediaGenerationRepositoryPort {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {
    super();
  }

  async create(input: NewMediaGeneration): Promise<MediaGenerationRecord> {
    try {
      const result = await withDbSpan(
        { table: "generated_media", operation: "INSERT" },
        () =>
          this.pool.query<MediaRow>(
            `insert into public.generated_media
               (id, user_id, kind, file_name, model_id, provider_prompt,
                parameters, citation)
             values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
             returning ${COLUMNS}`,
            [
              input.id,
              input.userId,
              input.kind,
              input.fileName,
              input.modelId,
              input.providerPrompt,
              JSON.stringify(input.parameters),
              input.citation === null ? null : JSON.stringify(input.citation),
            ],
          ),
      );

      const row = result.rows[0];

      if (row === undefined) throw new Error("media insert returned no row");

      return toRecord(row);
    } catch (error) {
      throw databaseFailure("create generated media", error);
    }
  }

  async findById(
    mediaId: string,
    userId: string,
  ): Promise<MediaGenerationRecord | null> {
    try {
      const result = await withDbSpan(
        { table: "generated_media", operation: "SELECT" },
        () =>
          this.pool.query<MediaRow>(
            `select ${COLUMNS} from public.generated_media
              where id = $1 and user_id = $2`,
            [mediaId, userId],
          ),
      );

      const row = result.rows[0];

      return row === undefined ? null : toRecord(row);
    } catch (error) {
      throw databaseFailure("load generated media", error);
    }
  }

  async claim(
    mediaId: string,
    userId: string,
    attempts: number,
  ): Promise<boolean> {
    try {
      const result = await withDbSpan(
        { table: "generated_media", operation: "UPDATE" },
        () =>
          this.pool.query(
            `update public.generated_media
                set status = 'generating', attempts = $3, updated_at = now()
              where id = $1 and user_id = $2 and status = 'queued'`,
            [mediaId, userId, attempts],
          ),
      );

      return result.rowCount === 1;
    } catch (error) {
      throw databaseFailure("claim media job", error);
    }
  }

  async markReady(
    mediaId: string,
    userId: string,
    update: MediaTerminalUpdate,
  ): Promise<MediaGenerationRecord | null> {
    try {
      const result = await withDbSpan(
        { table: "generated_media", operation: "UPDATE" },
        () =>
          this.pool.query<MediaRow>(
            `update public.generated_media
                set status = 'ready', content = $3, mime_type = $4,
                    byte_size = $5, width = $6, height = $7,
                    duration_seconds = $8, model_id = $9,
                    model_version = $10, estimated_cost_usd = $11,
                    error_code = null, error_message = null, updated_at = now()
              where id = $1 and user_id = $2
                and status in ('queued', 'generating')
             returning ${COLUMNS}`,
            [
              mediaId,
              userId,
              update.bytes,
              update.mimeType,
              update.bytes.byteLength,
              update.width,
              update.height,
              update.durationSeconds,
              update.modelId,
              update.modelVersion,
              update.estimatedCostUsd,
            ],
          ),
      );

      const row = result.rows[0];

      return row === undefined ? null : toRecord(row);
    } catch (error) {
      throw databaseFailure("complete media job", error);
    }
  }

  async markFailed(
    mediaId: string,
    userId: string,
    errorCode: MediaErrorCode,
    message: string,
  ): Promise<MediaGenerationRecord | null> {
    return this.terminalUpdate(mediaId, userId, "failed", errorCode, message);
  }

  async markCancelled(
    mediaId: string,
    userId: string,
  ): Promise<MediaGenerationRecord | null> {
    return this.terminalUpdate(mediaId, userId, "cancelled", "CANCELLED", null);
  }

  async requeue(
    mediaId: string,
    userId: string,
  ): Promise<MediaGenerationRecord | null> {
    try {
      const result = await withDbSpan(
        { table: "generated_media", operation: "UPDATE" },
        () =>
          this.pool.query<MediaRow>(
            `update public.generated_media
                set status = 'queued', content = null, mime_type = null,
                    byte_size = null, error_code = null, error_message = null,
                    attempts = least(attempts + 1, 3), updated_at = now()
              where id = $1 and user_id = $2
                and status in ('failed', 'cancelled', 'ready')
             returning ${COLUMNS}`,
            [mediaId, userId],
          ),
      );

      const row = result.rows[0];

      return row === undefined ? null : toRecord(row);
    } catch (error) {
      throw databaseFailure("requeue media job", error);
    }
  }

  async linkMessage(
    mediaId: string,
    messageId: string,
    conversationId: string,
    userId: string,
  ): Promise<void> {
    try {
      await withDbSpan({ table: "generated_media", operation: "UPDATE" }, () =>
        this.pool.query(
          `update public.generated_media g
                set message_id = $2, conversation_id = $3, updated_at = now()
               from public.conversations c
              where g.id = $1 and g.user_id = $4
                and c.id = $3 and c.user_id = $4`,
          [mediaId, messageId, conversationId, userId],
        ),
      );
    } catch (error) {
      throw databaseFailure("link media to message", error);
    }
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

  private async terminalUpdate(
    mediaId: string,
    userId: string,
    status: "failed" | "cancelled",
    errorCode: MediaErrorCode,
    message: string | null,
  ): Promise<MediaGenerationRecord | null> {
    try {
      const result = await withDbSpan(
        { table: "generated_media", operation: "UPDATE" },
        () =>
          this.pool.query<MediaRow>(
            `update public.generated_media
                set status = $3, content = null, mime_type = null,
                    byte_size = null, error_code = $4, error_message = $5,
                    updated_at = now()
              where id = $1 and user_id = $2
                and status in ('queued', 'generating')
             returning ${COLUMNS}`,
            [mediaId, userId, status, errorCode, message],
          ),
      );

      const row = result.rows[0];

      return row === undefined ? null : toRecord(row);
    } catch (error) {
      throw databaseFailure("finish media job", error);
    }
  }
}
