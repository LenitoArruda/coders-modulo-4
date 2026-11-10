import { Inject, Injectable } from "@nestjs/common";

import type { AuthUser } from "../domain/auth-user";
import { InvalidSessionError } from "../domain/invalid-session.error";

import { SessionTokenPort } from "./ports/session-token.port";
import { SessionsRepositoryPort } from "./ports/sessions-repository.port";
import { UsersRepositoryPort } from "./ports/users-repository.port";

/**
 * Validates a session on every authenticated request: a valid JWT signature
 * is not enough — the session must still be active (not revoked, not expired)
 * and belong to the token subject.
 */
@Injectable()
export class ValidateSessionUseCase {
  constructor(
    @Inject(SessionTokenPort)
    private readonly tokens: SessionTokenPort,
    @Inject(SessionsRepositoryPort)
    private readonly sessions: SessionsRepositoryPort,
    @Inject(UsersRepositoryPort)
    private readonly users: UsersRepositoryPort,
  ) {}

  async execute(token: string): Promise<AuthUser> {
    const claims = await this.tokens.verify(token);

    const session = await this.sessions.findActiveById(claims.sessionId);

    if (!session || session.userId !== claims.userId) {
      throw new InvalidSessionError();
    }

    const user = await this.users.findById(session.userId);

    if (!user) {
      throw new InvalidSessionError();
    }

    return user;
  }
}
