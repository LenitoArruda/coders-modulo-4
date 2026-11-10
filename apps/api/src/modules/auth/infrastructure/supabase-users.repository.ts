import { Inject, Injectable } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";

import { UsersRepositoryPort } from "../application/ports/users-repository.port";
import { SUPABASE_CLIENT } from "../auth.tokens";
import type { AuthUser } from "../domain/auth-user";

import { databaseFailure } from "./supabase-error";

const USER_COLUMNS = "id, first_name, last_name, email";

type UserRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
};

/** Reads the basic account data exposed by authenticated endpoints. */
@Injectable()
export class SupabaseUsersRepository extends UsersRepositoryPort {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly client: SupabaseClient,
  ) {
    super();
  }

  async findById(id: string): Promise<AuthUser | null> {
    const { data, error } = await this.client
      .from("users")
      .select(USER_COLUMNS)
      .eq("id", id)
      .maybeSingle<UserRow>();

    if (error !== null) {
      throw databaseFailure("load user", error);
    }

    if (data === null) {
      return null;
    }

    return {
      id: data.id,
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email,
    };
  }
}
