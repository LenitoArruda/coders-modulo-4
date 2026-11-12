import { Inject, Injectable } from "@nestjs/common";
import type { Pool, QueryResult } from "pg";

import {
  SessionsRepositoryPort,
  type SessionCreation,
} from "../application/ports/sessions-repository.port";
import type { Session, SessionOrigin } from "../domain/session";
import { DATABASE_POOL } from "../../shared/database/database.tokens";
import { withDbSpan } from "../../shared/observability/db-span";

import { databaseFailure } from "./database-error";

const SESSION_COLUMNS =
  "id, user_id, origin, created_at, expires_at, revoked_at";

type SessionRow = {
  id: string;
  user_id: string;
  origin: SessionOrigin;
  created_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
};

function toSession(row: SessionRow): Session {
  return {
    id: row.id,
    userId: row.user_id,
    origin: row.origin,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  };
}

/**
 * Server-side session registry on top of `pg`. The API is the only database
 * client, so these tables are never reached directly by the browser.
 */
@Injectable()
export class PostgresSessionsRepository extends SessionsRepositoryPort {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {
    super();
  }

  async create(creation: SessionCreation): Promise<Session> {
    let result: QueryResult<SessionRow>;

    try {
      result = await withDbSpan(
        { table: "sessions", operation: "INSERT" },
        () =>
          this.pool.query<SessionRow>(
            `insert into public.sessions (user_id, origin, expires_at)
           values ($1, $2, $3)
           returning ${SESSION_COLUMNS}`,
            [creation.userId, creation.origin, creation.expiresAt],
          ),
      );
    } catch (error) {
      throw databaseFailure("create session", error);
    }

    const row = result.rows[0];

    if (row === undefined) {
      throw databaseFailure("create session", null);
    }

    return toSession(row);
  }

  async revokeAllActiveExcept(
    userId: string,
    keepSessionId: string,
  ): Promise<void> {
    try {
      await withDbSpan({ table: "sessions", operation: "UPDATE" }, () =>
        this.pool.query(
          `update public.sessions
           set revoked_at = now()
           where user_id = $1
             and revoked_at is null
             and expires_at > now()
             and id <> $2`,
          [userId, keepSessionId],
        ),
      );
    } catch (error) {
      throw databaseFailure("revoke sessions", error);
    }
  }

  async revokeAllActive(userId: string): Promise<void> {
    try {
      await withDbSpan({ table: "sessions", operation: "UPDATE" }, () =>
        this.pool.query(
          `update public.sessions
           set revoked_at = now()
           where user_id = $1
             and revoked_at is null
             and expires_at > now()`,
          [userId],
        ),
      );
    } catch (error) {
      throw databaseFailure("revoke sessions", error);
    }
  }

  async revoke(userId: string, sessionId: string): Promise<void> {
    try {
      await withDbSpan({ table: "sessions", operation: "UPDATE" }, () =>
        this.pool.query(
          `update public.sessions
           set revoked_at = now()
           where id = $1 and user_id = $2 and revoked_at is null`,
          [sessionId, userId],
        ),
      );
    } catch (error) {
      throw databaseFailure("revoke session", error);
    }
  }

  async findActiveById(sessionId: string): Promise<Session | null> {
    try {
      const result = await withDbSpan(
        { table: "sessions", operation: "SELECT" },
        () =>
          this.pool.query<SessionRow>(
            `select ${SESSION_COLUMNS}
             from public.sessions
             where id = $1
               and revoked_at is null
               and expires_at > now()`,
            [sessionId],
          ),
      );

      const row = result.rows[0];

      return row === undefined ? null : toSession(row);
    } catch (error) {
      throw databaseFailure("load session", error);
    }
  }
}
