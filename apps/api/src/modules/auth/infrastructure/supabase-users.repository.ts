import { Inject, Injectable } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  UsersRepositoryPort,
  type CreateUserRecord,
  type UserAccount,
} from "../application/ports/users-repository.port";
import { SUPABASE_CLIENT } from "../auth.tokens";
import type { AuthUser } from "../domain/auth-user";
import { DuplicateEmailError } from "../domain/sign-up.errors";
import { withDbSpan } from "../../shared/observability/db-span";

import { databaseFailure } from "./supabase-error";

const USER_COLUMNS = "id, first_name, last_name, email";
const USER_ACCOUNT_COLUMNS = `${USER_COLUMNS}, email_confirmed_at, password_hash`;

type UserRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
};

type UserAccountRow = UserRow & {
  email_confirmed_at: string | null;
  password_hash: string;
};

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
  };
}

function toUserAccount(row: UserAccountRow): UserAccount {
  return {
    ...toAuthUser(row),
    emailConfirmedAt:
      row.email_confirmed_at === null ? null : new Date(row.email_confirmed_at),
    passwordHash: row.password_hash,
  };
}

/** Reads and creates the account data used by auth flows. */
@Injectable()
export class SupabaseUsersRepository extends UsersRepositoryPort {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly client: SupabaseClient,
  ) {
    super();
  }

  async findById(id: string): Promise<AuthUser | null> {
    const { data, error } = await withDbSpan(
      { table: "users", operation: "SELECT" },
      this.client
        .from("users")
        .select(USER_COLUMNS)
        .eq("id", id)
        .maybeSingle<UserRow>(),
    );

    if (error !== null) {
      throw databaseFailure("load user", error);
    }

    if (data === null) {
      return null;
    }

    return toAuthUser(data);
  }

  async findByEmail(email: string): Promise<UserAccount | null> {
    const { data, error } = await withDbSpan(
      { table: "users", operation: "SELECT" },
      this.client
        .from("users")
        .select(USER_ACCOUNT_COLUMNS)
        .eq("email", email)
        .maybeSingle<UserAccountRow>(),
    );

    if (error !== null) {
      throw databaseFailure("load user by email", error);
    }

    return data === null ? null : toUserAccount(data);
  }

  async findAccountById(id: string): Promise<UserAccount | null> {
    const { data, error } = await withDbSpan(
      { table: "users", operation: "SELECT" },
      this.client
        .from("users")
        .select(USER_ACCOUNT_COLUMNS)
        .eq("id", id)
        .maybeSingle<UserAccountRow>(),
    );

    if (error !== null) {
      throw databaseFailure("load user account", error);
    }

    return data === null ? null : toUserAccount(data);
  }

  async confirmEmail(id: string): Promise<boolean> {
    const { data, error } = await withDbSpan(
      { table: "users", operation: "UPDATE" },
      this.client
        .from("users")
        .update({ email_confirmed_at: new Date().toISOString() })
        .eq("id", id)
        .is("email_confirmed_at", null)
        .select("id")
        .maybeSingle<{ id: string }>(),
    );

    if (error !== null) {
      throw databaseFailure("confirm user email", error);
    }

    return data !== null;
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    const { error } = await withDbSpan(
      { table: "users", operation: "UPDATE" },
      this.client
        .from("users")
        .update({ password_hash: passwordHash })
        .eq("id", id),
    );

    if (error !== null) {
      throw databaseFailure("update user password", error);
    }
  }

  async create(record: CreateUserRecord): Promise<UserAccount> {
    const { data, error } = await withDbSpan(
      { table: "users", operation: "INSERT" },
      this.client
        .from("users")
        .insert({
          first_name: record.firstName,
          last_name: record.lastName,
          email: record.email,
          password_hash: record.passwordHash,
        })
        .select(USER_ACCOUNT_COLUMNS)
        .single<UserAccountRow>(),
    );

    if (error !== null) {
      // Unique index violation: another request created the same email first.
      if (error.code === "23505") {
        throw new DuplicateEmailError();
      }

      throw databaseFailure("create user", error);
    }

    if (data === null) {
      throw databaseFailure("create user", error);
    }

    return toUserAccount(data);
  }
}
