import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";

import {
  databaseFailure,
  postgresErrorCode,
} from "../../auth/infrastructure/database-error";
import { DATABASE_POOL } from "../../shared/database/database.tokens";
import { withDbSpan } from "../../shared/observability/db-span";
import { SourcesRepositoryPort } from "../application/ports/sources-repository.port";
import type {
  Chunk,
  NewSourceVersion,
  Source,
  SourceStatus,
  SourceSummary,
  SourceType,
  SourceVersion,
} from "../domain/source";

const SOURCE_COLUMNS =
  "id, user_id, name, normalized_name, type, current_version_id, created_at, updated_at";
const VERSION_COLUMNS =
  "id, source_id, user_id, content_hash, original_name, mime_type, byte_size, type, status, chunk_count, error_message, created_at, updated_at";

type SourceRow = {
  id: string;
  user_id: string;
  name: string;
  normalized_name: string;
  type: SourceType;
  current_version_id: string | null;
  created_at: Date;
  updated_at: Date;
};

type VersionRow = {
  id: string;
  source_id: string;
  user_id: string;
  content_hash: string;
  original_name: string;
  mime_type: string;
  byte_size: string | number;
  type: SourceType;
  status: SourceStatus;
  chunk_count: number;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
};

type SummaryRow = {
  id: string;
  name: string;
  type: SourceType;
  byte_size: string | number;
  status: SourceStatus;
  version_id: string;
  version_number: string | number;
  chunk_count: number;
  created_at: Date;
};

function toSource(row: SourceRow): Source {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    normalizedName: row.normalized_name,
    type: row.type,
    currentVersionId: row.current_version_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toVersion(row: VersionRow): SourceVersion {
  return {
    id: row.id,
    sourceId: row.source_id,
    userId: row.user_id,
    contentHash: row.content_hash.trim(),
    originalName: row.original_name,
    mimeType: row.mime_type,
    byteSize: Number(row.byte_size),
    type: row.type,
    status: row.status,
    chunkCount: row.chunk_count,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSummary(row: SummaryRow): SourceSummary {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    byteSize: Number(row.byte_size),
    status: row.status,
    versionId: row.version_id,
    versionNumber: Number(row.version_number),
    chunkCount: row.chunk_count,
    isStale: false,
    createdAt: row.created_at,
  };
}

/**
 * Source persistence on `pg`. Every statement includes `user_id`, so ownership
 * is enforced in SQL even when a caller passes a foreign identifier.
 */
@Injectable()
export class PostgresSourcesRepository extends SourcesRepositoryPort {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {
    super();
  }

  async findVersionByHash(
    userId: string,
    contentHash: string,
  ): Promise<SourceVersion | null> {
    try {
      const result = await withDbSpan(
        { table: "source_versions", operation: "SELECT" },
        () =>
          this.pool.query<VersionRow>(
            `select ${VERSION_COLUMNS}
             from public.source_versions
             where user_id = $1 and content_hash = $2 and status <> 'failed'
             order by created_at desc
             limit 1`,
            [userId, contentHash],
          ),
      );
      const row = result.rows[0];

      return row === undefined ? null : toVersion(row);
    } catch (error) {
      throw databaseFailure("find source version by hash", error);
    }
  }

  async findSourceByNormalizedName(
    userId: string,
    normalizedName: string,
  ): Promise<Source | null> {
    try {
      const result = await withDbSpan(
        { table: "sources", operation: "SELECT" },
        () =>
          this.pool.query<SourceRow>(
            `select ${SOURCE_COLUMNS}
             from public.sources
             where user_id = $1 and normalized_name = $2`,
            [userId, normalizedName],
          ),
      );
      const row = result.rows[0];

      return row === undefined ? null : toSource(row);
    } catch (error) {
      throw databaseFailure("find source by name", error);
    }
  }

  async createSource(
    userId: string,
    name: string,
    normalizedName: string,
    type: SourceType,
  ): Promise<Source> {
    try {
      await withDbSpan({ table: "sources", operation: "INSERT" }, () =>
        this.pool.query(
          `insert into public.sources (user_id, name, normalized_name, type)
             values ($1, $2, $3, $4)
             on conflict (user_id, normalized_name) do nothing`,
          [userId, name, normalizedName, type],
        ),
      );

      const existing = await this.findSourceByNormalizedName(
        userId,
        normalizedName,
      );

      if (existing === null) {
        throw new Error("source insert returned no row");
      }

      return existing;
    } catch (error) {
      throw databaseFailure("create source", error);
    }
  }

  async createVersion(
    input: NewSourceVersion & { userId: string },
  ): Promise<SourceVersion | null> {
    try {
      const result = await withDbSpan(
        { table: "source_versions", operation: "INSERT" },
        () =>
          this.pool.query<VersionRow>(
            `insert into public.source_versions
               (source_id, user_id, content_hash, original_name, mime_type,
                byte_size, type, status)
             values ($1, $2, $3, $4, $5, $6, $7, $8)
             returning ${VERSION_COLUMNS}`,
            [
              input.sourceId,
              input.userId,
              input.contentHash,
              input.originalName,
              input.mimeType,
              input.byteSize,
              input.type,
              input.status,
            ],
          ),
      );
      const row = result.rows[0];

      return row === undefined ? null : toVersion(row);
    } catch (error) {
      if (postgresErrorCode(error) === "23505") return null;

      throw databaseFailure("create source version", error);
    }
  }

  async findVersion(
    userId: string,
    versionId: string,
  ): Promise<SourceVersion | null> {
    try {
      const result = await withDbSpan(
        { table: "source_versions", operation: "SELECT" },
        () =>
          this.pool.query<VersionRow>(
            `select ${VERSION_COLUMNS}
             from public.source_versions
             where user_id = $1 and id = $2`,
            [userId, versionId],
          ),
      );
      const row = result.rows[0];

      return row === undefined ? null : toVersion(row);
    } catch (error) {
      throw databaseFailure("find source version", error);
    }
  }

  async saveFile(
    userId: string,
    versionId: string,
    content: Buffer,
  ): Promise<void> {
    try {
      await withDbSpan({ table: "source_files", operation: "INSERT" }, () =>
        this.pool.query(
          `insert into public.source_files
               (source_version_id, user_id, content, byte_size)
             values ($1, $2, $3, $4)
             on conflict (source_version_id) do update
             set content = excluded.content, byte_size = excluded.byte_size`,
          [versionId, userId, content, content.byteLength],
        ),
      );
    } catch (error) {
      throw databaseFailure("save source file", error);
    }
  }

  async findFile(userId: string, versionId: string): Promise<Buffer | null> {
    try {
      const result = await withDbSpan(
        { table: "source_files", operation: "SELECT" },
        () =>
          this.pool.query<{ content: Buffer }>(
            `select f.content
             from public.source_files f
             join public.source_versions v
               on v.id = f.source_version_id and v.user_id = f.user_id
             where f.user_id = $1 and f.source_version_id = $2`,
            [userId, versionId],
          ),
      );
      const row = result.rows[0];

      return row === undefined ? null : Buffer.from(row.content);
    } catch (error) {
      throw databaseFailure("load source file", error);
    }
  }

  async saveChunks(chunks: Chunk[]): Promise<void> {
    try {
      for (const chunk of chunks) {
        await withDbSpan({ table: "source_chunks", operation: "INSERT" }, () =>
          this.pool.query(
            `insert into public.source_chunks
                 (id, source_id, source_version_id, user_id, chunk_index, content)
               values ($1, $2, $3, $4, $5, $6)
               on conflict (source_version_id, chunk_index) do nothing`,
            [
              chunk.id,
              chunk.sourceId,
              chunk.sourceVersionId,
              chunk.userId,
              chunk.index,
              chunk.content,
            ],
          ),
        );
      }
    } catch (error) {
      throw databaseFailure("save source chunks", error);
    }
  }

  async updateVersionStatus(
    userId: string,
    versionId: string,
    status: SourceStatus,
    chunkCount?: number,
    errorMessage?: string | null,
  ): Promise<void> {
    try {
      await withDbSpan({ table: "source_versions", operation: "UPDATE" }, () =>
        this.pool.query(
          `update public.source_versions
             set status = $3,
                 chunk_count = coalesce($4, chunk_count),
                 error_message = $5,
                 processed_at = case when $3 in ('ready', 'failed')
                   then now() else processed_at end
             where user_id = $1 and id = $2`,
          [userId, versionId, status, chunkCount ?? null, errorMessage ?? null],
        ),
      );
    } catch (error) {
      throw databaseFailure("update source version status", error);
    }
  }

  async activateVersion(
    userId: string,
    sourceId: string,
    versionId: string,
  ): Promise<void> {
    try {
      await withDbSpan({ table: "sources", operation: "UPDATE" }, () =>
        this.pool.query(
          `update public.sources
             set current_version_id = $3
             where user_id = $1 and id = $2`,
          [userId, sourceId, versionId],
        ),
      );
    } catch (error) {
      throw databaseFailure("activate source version", error);
    }
  }

  async listSources(userId: string): Promise<SourceSummary[]> {
    try {
      const result = await withDbSpan(
        { table: "sources", operation: "SELECT" },
        () =>
          this.pool.query<SummaryRow>(
            `select s.id, s.name, s.type, v.byte_size, v.status,
                    v.id as version_id,
                    (select count(*) from public.source_versions sv
                     where sv.source_id = s.id and sv.created_at <= v.created_at)
                      as version_number,
                    v.chunk_count, s.created_at
             from public.sources s
             join public.source_versions v
               on v.id = s.current_version_id and v.user_id = s.user_id
             where s.user_id = $1
             order by s.updated_at desc, s.id desc`,
            [userId],
          ),
      );

      return result.rows.map(toSummary);
    } catch (error) {
      throw databaseFailure("list sources", error);
    }
  }

  async findForDeletion(
    userId: string,
    sourceId: string,
  ): Promise<{ sourceId: string; versionIds: string[] } | null> {
    try {
      const result = await withDbSpan(
        { table: "sources", operation: "SELECT" },
        () =>
          this.pool.query<{ id: string; version_ids: string[] }>(
            `select s.id,
                    coalesce(
                      array_agg(v.id order by v.created_at, v.id)
                        filter (where v.id is not null),
                      '{}'::uuid[]
                    ) as version_ids
             from public.sources s
             left join public.source_versions v
               on v.source_id = s.id and v.user_id = s.user_id
             where s.user_id = $1 and s.id = $2
             group by s.id`,
            [userId, sourceId],
          ),
      );
      const row = result.rows[0];

      return row === undefined
        ? null
        : { sourceId: row.id, versionIds: row.version_ids };
    } catch (error) {
      throw databaseFailure("find source for deletion", error);
    }
  }

  async deleteSource(userId: string, sourceId: string): Promise<boolean> {
    try {
      const result = await withDbSpan(
        { table: "sources", operation: "DELETE" },
        () =>
          this.pool.query(
            `delete from public.sources
             where user_id = $1 and id = $2`,
            [userId, sourceId],
          ),
      );

      return (result.rowCount ?? 0) === 1;
    } catch (error) {
      throw databaseFailure("delete source", error);
    }
  }
}
