import type { AuthUser } from "../../modules/auth/domain/auth-user";
import { UsersRepositoryPort } from "../../modules/auth/application/ports/users-repository.port";

/** In-memory fake used by unit and integration tests. */
export class InMemoryUsersRepository extends UsersRepositoryPort {
  readonly users: AuthUser[] = [];

  async findById(id: string): Promise<AuthUser | null> {
    return this.users.find((user) => user.id === id) ?? null;
  }

  /** Test helper that bypasses the port to seed users. */
  seed(user: AuthUser): AuthUser {
    this.users.push(user);

    return user;
  }
}
