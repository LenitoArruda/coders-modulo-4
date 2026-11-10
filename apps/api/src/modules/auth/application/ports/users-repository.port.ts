import type { AuthUser } from "../../domain/auth-user";

export abstract class UsersRepositoryPort {
  abstract findById(id: string): Promise<AuthUser | null>;
}
