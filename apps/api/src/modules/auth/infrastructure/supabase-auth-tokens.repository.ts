import { Inject, Injectable } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";

import { AuthTokensRepositoryPort } from "../application/ports/auth-tokens-repository.port";
import { SUPABASE_CLIENT } from "../auth.tokens";

import { databaseFailure } from "./supabase-error";

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
