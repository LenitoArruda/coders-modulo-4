import { Inject, Injectable } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  SessionsRepositoryPort,
  type SessionCreation,
} from "../application/ports/sessions-repository.port";
import { SUPABASE_CLIENT } from "../auth.tokens";
import type { Session, SessionOrigin } from "../domain/session";
import { withDbSpan } from "../../shared/observability/db-span";

import { databaseFailure } from "./supabase-error";

const SESSION_COLUMNS =
  "id, user_id, origin, created_at, expires_at, revoked_at";

type SessionRow = {
  id: string;
  user_id: string;
  origin: SessionOrigin;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
};

function toSession(row: SessionRow): Session {
  return {
    id: row.id,
    userId: row.user_id,
    origin: row.origin,
    createdAt: new Date(row.created_at),
    expiresAt: new Date(row.expires_at),
    revokedAt: row.revoked_at === null ? null : new Date(row.revoked_at),
  };
}

/**
 * Server-side session registry on top of PostgREST with the service role
 * credential (RLS bypassed; the browser never reaches these tables directly).
 */
@Injectable()
export class SupabaseSessionsRepository extends SessionsRepositoryPort {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly client: SupabaseClient,
  ) {
    super();
  }

  async create(creation: SessionCreation): Promise<Session> {
    const { data, error } = await withDbSpan(
      { table: "sessions", operation: "INSERT" },
      this.client
        .from("sessions")
        .insert({
          user_id: creation.userId,
          origin: creation.origin,
          expires_at: creation.expiresAt.toISOString(),
        })
        .select(SESSION_COLUMNS)
        .single<SessionRow>(),
    );

    if (error !== null || data === null) {
      throw databaseFailure("create session", error);
    }

    return toSession(data);
  }

  async revokeAllActiveExcept(
    userId: string,
    keepSessionId: string,
  ): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await withDbSpan(
      { table: "sessions", operation: "UPDATE" },
      this.client
        .from("sessions")
        .update({ revoked_at: now })
        .eq("user_id", userId)
        .is("revoked_at", null)
        .gt("expires_at", now)
        .neq("id", keepSessionId),
    );

    if (error !== null) {
      throw databaseFailure("revoke sessions", error);
    }
  }

  async revokeAllActive(userId: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await withDbSpan(
      { table: "sessions", operation: "UPDATE" },
      this.client
        .from("sessions")
        .update({ revoked_at: now })
        .eq("user_id", userId)
        .is("revoked_at", null)
        .gt("expires_at", now),
    );

    if (error !== null) {
      throw databaseFailure("revoke sessions", error);
    }
  }

  async revoke(userId: string, sessionId: string): Promise<void> {
    const { error } = await withDbSpan(
      { table: "sessions", operation: "UPDATE" },
      this.client
        .from("sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", sessionId)
        .eq("user_id", userId)
        .is("revoked_at", null),
    );

    if (error !== null) {
      throw databaseFailure("revoke session", error);
    }
  }

  async findActiveById(sessionId: string): Promise<Session | null> {
    const { data, error } = await withDbSpan(
      { table: "sessions", operation: "SELECT" },
      this.client
        .from("sessions")
        .select(SESSION_COLUMNS)
        .eq("id", sessionId)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle<SessionRow>(),
    );

    if (error !== null) {
      throw databaseFailure("load session", error);
    }

    return data === null ? null : toSession(data);
  }
}
