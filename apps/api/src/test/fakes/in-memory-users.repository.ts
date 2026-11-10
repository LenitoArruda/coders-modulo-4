import { randomUUID } from "node:crypto";

import {
  UsersRepositoryPort,
  type CreateUserRecord,
  type UserAccount,
} from "../../modules/auth/application/ports/users-repository.port";
import type { AuthUser } from "../../modules/auth/domain/auth-user";
import { DuplicateEmailError } from "../../modules/auth/domain/sign-up.errors";

type SeedUser = Omit<AuthUser, "id"> & {
  id?: string;
  emailConfirmedAt?: Date | null;
  passwordHash?: string;
};

/** In-memory fake used by unit and integration tests. */
export class InMemoryUsersRepository extends UsersRepositoryPort {
  readonly users: UserAccount[] = [];

  async findById(id: string): Promise<AuthUser | null> {
    const user = this.users.find((candidate) => candidate.id === id);

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    };
  }

  async findByEmail(email: string): Promise<UserAccount | null> {
    const normalized = email.trim().toLowerCase();

    return (
      this.users.find((candidate) => candidate.email === normalized) ?? null
    );
  }

  async create(record: CreateUserRecord): Promise<UserAccount> {
    if ((await this.findByEmail(record.email)) !== null) {
      throw new DuplicateEmailError();
    }

    const account: UserAccount = {
      id: randomUUID(),
      firstName: record.firstName,
      lastName: record.lastName,
      email: record.email.trim().toLowerCase(),
      emailConfirmedAt: null,
      passwordHash: record.passwordHash,
    };

    this.users.push(account);

    return account;
  }

  /** Test helper that bypasses the port to seed users. */
  seed(user: SeedUser): UserAccount {
    const account: UserAccount = {
      id: user.id ?? randomUUID(),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email.trim().toLowerCase(),
      emailConfirmedAt: user.emailConfirmedAt ?? null,
      passwordHash: user.passwordHash ?? "seed-hash",
    };

    this.users.push(account);

    return account;
  }
}
