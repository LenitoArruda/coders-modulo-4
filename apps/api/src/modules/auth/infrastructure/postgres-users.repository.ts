import { Inject, Injectable } from "@nestjs/common";
import type { Pool, QueryResult } from "pg";

import {
  UsersRepositoryPort,
  type CreateUserRecord,
  type UserAccount,
} from "../application/ports/users-repository.port";
import type { AuthUser } from "../domain/auth-user";
import { DuplicateEmailError } from "../domain/sign-up.errors";
import { DATABASE_POOL } from "../../shared/database/database.tokens";
import { withDbSpan } from "../../shared/observability/db-span";

import { databaseFailure, postgresErrorCode } from "./database-error";

const USER_COLUMNS = "id, first_name, last_name, email";
const USER_ACCOUNT_COLUMNS = `${USER_COLUMNS}, email_confirmed_at, password_hash`;

/** SQLSTATE raised when a unique index is violated. */
const UNIQUE_VIOLATION = "23505";

type UserRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
};

type UserAccountRow = UserRow & {
  email_confirmed_at: Date | null;
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
    emailConfirmedAt: row.email_confirmed_at,
    passwordHash: row.password_hash,
  };
}

/** Reads and creates the account data used by auth flows. */
@Injectable()
export class PostgresUsersRepository extends UsersRepositoryPort {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {
    super();
  }

  async findById(id: string): Promise<AuthUser | null> {
    try {
      const result = await withDbSpan(
        { table: "users", operation: "SELECT" },
        () =>
          this.pool.query<UserRow>(
            `select ${USER_COLUMNS} from public.users where id = $1`,
            [id],
          ),
      );

      const row = result.rows[0];

      return row === undefined ? null : toAuthUser(row);
    } catch (error) {
      throw databaseFailure("load user", error);
    }
  }

  async findByEmail(email: string): Promise<UserAccount | null> {
    try {
      const result = await withDbSpan(
        { table: "users", operation: "SELECT" },
        () =>
          this.pool.query<UserAccountRow>(
            `select ${USER_ACCOUNT_COLUMNS} from public.users where email = $1`,
            [email],
          ),
      );

      const row = result.rows[0];

      return row === undefined ? null : toUserAccount(row);
    } catch (error) {
      throw databaseFailure("load user by email", error);
    }
  }

  async findAccountById(id: string): Promise<UserAccount | null> {
    try {
      const result = await withDbSpan(
        { table: "users", operation: "SELECT" },
        () =>
          this.pool.query<UserAccountRow>(
            `select ${USER_ACCOUNT_COLUMNS} from public.users where id = $1`,
            [id],
          ),
      );

      const row = result.rows[0];

      return row === undefined ? null : toUserAccount(row);
    } catch (error) {
      throw databaseFailure("load user account", error);
    }
  }

  async confirmEmail(id: string): Promise<boolean> {
    try {
      const result = await withDbSpan(
        { table: "users", operation: "UPDATE" },
        () =>
          this.pool.query(
            `update public.users
             set email_confirmed_at = now()
             where id = $1 and email_confirmed_at is null`,
            [id],
          ),
      );

      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      throw databaseFailure("confirm user email", error);
    }
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    try {
      await withDbSpan({ table: "users", operation: "UPDATE" }, () =>
        this.pool.query(
          "update public.users set password_hash = $2 where id = $1",
          [id, passwordHash],
        ),
      );
    } catch (error) {
      throw databaseFailure("update user password", error);
    }
  }

  async create(record: CreateUserRecord): Promise<UserAccount> {
    let result: QueryResult<UserAccountRow>;

    try {
      result = await withDbSpan({ table: "users", operation: "INSERT" }, () =>
        this.pool.query<UserAccountRow>(
          `insert into public.users (first_name, last_name, email, password_hash)
           values ($1, $2, $3, $4)
           returning ${USER_ACCOUNT_COLUMNS}`,
          [
            record.firstName,
            record.lastName,
            record.email,
            record.passwordHash,
          ],
        ),
      );
    } catch (error) {
      // Unique index violation: another request created the same email first.
      if (postgresErrorCode(error) === UNIQUE_VIOLATION) {
        throw new DuplicateEmailError();
      }

      throw databaseFailure("create user", error);
    }

    const row = result.rows[0];

    if (row === undefined) {
      throw databaseFailure("create user", null);
    }

    return toUserAccount(row);
  }
}
