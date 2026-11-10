import { randomUUID } from "node:crypto";

import {
  AuthTokensRepositoryPort,
  type AuthTokenCreation,
  type AuthTokenPurpose,
} from "../../modules/auth/application/ports/auth-tokens-repository.port";

export type StoredAuthToken = AuthTokenCreation & {
  id: string;
  usedAt: Date | null;
  createdAt: Date;
};

/** In-memory auth token registry used by unit and integration tests. */
export class InMemoryAuthTokensRepository extends AuthTokensRepositoryPort {
  readonly tokens: StoredAuthToken[] = [];

  async create(creation: AuthTokenCreation): Promise<void> {
    this.tokens.push({
      ...creation,
      id: randomUUID(),
      usedAt: null,
      createdAt: new Date(),
    });
  }

  async invalidateUnused(
    userId: string,
    purpose: AuthTokenPurpose,
  ): Promise<void> {
    const now = new Date();

    for (const token of this.tokens) {
      if (
        token.userId === userId &&
        token.purpose === purpose &&
        token.usedAt === null
      ) {
        token.usedAt = now;
      }
    }
  }
}
