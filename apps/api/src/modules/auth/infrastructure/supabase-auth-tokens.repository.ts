import { Inject, Injectable } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  AuthTokensRepositoryPort,
  type AuthTokenPurpose,
  type AuthTokenRecord,
} from "../application/ports/auth-tokens-repository.port";
import { SUPABASE_CLIENT } from "../auth.tokens";

import { databaseFailure } from "./supabase-error";

const AUTH_TOKEN_COLUMNS =
  "id, user_id, purpose, token_hash, expires_at, used_at, created_at";

type AuthTokenRow = {
  id: string;
  user_id: string;
  purpose: AuthTokenPurpose;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
};

function toAuthToken(row: AuthTokenRow): AuthTokenRecord {
  return {
    id: row.id,
    userId: row.user_id,
    purpose: row.purpose,
    tokenHash: row.token_hash,
    expiresAt: new Date(row.expires_at),
    usedAt: row.used_at === null ? null : new Date(row.used_at),
    createdAt: new Date(row.created_at),
  };
}

/**
 * Opaque token registry on top of PostgREST with the service role credential.
 * Only hashes are written; the clear token never reaches this adapter.
 */
@Injectable()
export class SupabaseAuthTokensRepository extends AuthTokensRepositoryPort {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly client: SupabaseClient,
  ) {
    super();
  }

  async create(
    creation: Parameters<AuthTokensRepositoryPort["create"]>[0],
  ): Promise<void> {
    const { error } = await this.client.from("auth_tokens").insert({
      user_id: creation.userId,
      purpose: creation.purpose,
      token_hash: creation.tokenHash,
      expires_at: creation.expiresAt.toISOString(),
    });

    if (error !== null) {
      throw databaseFailure("create auth token", error);
    }
  }

  async findByHash(tokenHash: string): Promise<AuthTokenRecord | null> {
    const { data, error } = await this.client
      .from("auth_tokens")
      .select(AUTH_TOKEN_COLUMNS)
      .eq("token_hash", tokenHash)
      .maybeSingle<AuthTokenRow>();

    if (error !== null) {
      throw databaseFailure("load auth token", error);
    }

    return data === null ? null : toAuthToken(data);
  }

  async consume(tokenId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from("auth_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", tokenId)
      .is("used_at", null)
      .select("id")
      .maybeSingle<{ id: string }>();

    if (error !== null) {
      throw databaseFailure("consume auth token", error);
    }

    return data !== null;
  }

  async invalidateUnused(
    userId: string,
    purpose: Parameters<AuthTokensRepositoryPort["invalidateUnused"]>[1],
  ): Promise<void> {
    const { error } = await this.client
      .from("auth_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("purpose", purpose)
      .is("used_at", null);

    if (error !== null) {
      throw databaseFailure("invalidate auth tokens", error);
    }
  }

  async invalidateUnusedExcept(
    userId: string,
    purpose: Parameters<AuthTokensRepositoryPort["invalidateUnusedExcept"]>[1],
    keepTokenHash: string,
  ): Promise<void> {
    const { error } = await this.client
      .from("auth_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("purpose", purpose)
      .is("used_at", null)
      .neq("token_hash", keepTokenHash);

    if (error !== null) {
      throw databaseFailure("invalidate previous auth tokens", error);
    }
  }
}
