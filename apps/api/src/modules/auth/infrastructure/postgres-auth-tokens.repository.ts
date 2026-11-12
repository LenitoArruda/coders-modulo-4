import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";

import {
  AuthTokensRepositoryPort,
  type AuthTokenPurpose,
  type AuthTokenRecord,
} from "../application/ports/auth-tokens-repository.port";
import { DATABASE_POOL } from "../../shared/database/database.tokens";
import { withDbSpan } from "../../shared/observability/db-span";

import { databaseFailure } from "./database-error";

const AUTH_TOKEN_COLUMNS =
  "id, user_id, purpose, token_hash, expires_at, used_at, created_at";

type AuthTokenRow = {
  id: string;
  user_id: string;
  purpose: AuthTokenPurpose;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
};

function toAuthToken(row: AuthTokenRow): AuthTokenRecord {
  return {
    id: row.id,
    userId: row.user_id,
    purpose: row.purpose,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    createdAt: row.created_at,
  };
}

/**
 * Opaque token registry on top of `pg`. Only hashes are written; the clear
 * token never reaches this adapter.
 */
@Injectable()
export class PostgresAuthTokensRepository extends AuthTokensRepositoryPort {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {
    super();
  }

  async create(
    creation: Parameters<AuthTokensRepositoryPort["create"]>[0],
  ): Promise<void> {
    try {
      await withDbSpan({ table: "auth_tokens", operation: "INSERT" }, () =>
        this.pool.query(
          `insert into public.auth_tokens (user_id, purpose, token_hash, expires_at)
           values ($1, $2, $3, $4)`,
          [
            creation.userId,
            creation.purpose,
            creation.tokenHash,
            creation.expiresAt,
          ],
        ),
      );
    } catch (error) {
      throw databaseFailure("create auth token", error);
    }
  }

  async findByHash(tokenHash: string): Promise<AuthTokenRecord | null> {
    try {
      const result = await withDbSpan(
        { table: "auth_tokens", operation: "SELECT" },
        () =>
          this.pool.query<AuthTokenRow>(
            `select ${AUTH_TOKEN_COLUMNS}
             from public.auth_tokens
             where token_hash = $1`,
            [tokenHash],
          ),
      );

      const row = result.rows[0];

      return row === undefined ? null : toAuthToken(row);
    } catch (error) {
      throw databaseFailure("load auth token", error);
    }
  }

  async consume(tokenId: string): Promise<boolean> {
    try {
      const result = await withDbSpan(
        { table: "auth_tokens", operation: "UPDATE" },
        () =>
          this.pool.query(
            `update public.auth_tokens
             set used_at = now()
             where id = $1 and used_at is null`,
            [tokenId],
          ),
      );

      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      throw databaseFailure("consume auth token", error);
    }
  }

  async invalidateUnused(
    userId: string,
    purpose: Parameters<AuthTokensRepositoryPort["invalidateUnused"]>[1],
  ): Promise<void> {
    try {
      await withDbSpan({ table: "auth_tokens", operation: "UPDATE" }, () =>
        this.pool.query(
          `update public.auth_tokens
           set used_at = now()
           where user_id = $1 and purpose = $2 and used_at is null`,
          [userId, purpose],
        ),
      );
    } catch (error) {
      throw databaseFailure("invalidate auth tokens", error);
    }
  }

  async invalidateUnusedExcept(
    userId: string,
    purpose: Parameters<AuthTokensRepositoryPort["invalidateUnusedExcept"]>[1],
    keepTokenHash: string,
  ): Promise<void> {
    try {
      await withDbSpan({ table: "auth_tokens", operation: "UPDATE" }, () =>
        this.pool.query(
          `update public.auth_tokens
           set used_at = now()
           where user_id = $1
             and purpose = $2
             and used_at is null
             and token_hash <> $3`,
          [userId, purpose, keepTokenHash],
        ),
      );
    } catch (error) {
      throw databaseFailure("invalidate previous auth tokens", error);
    }
  }
}
