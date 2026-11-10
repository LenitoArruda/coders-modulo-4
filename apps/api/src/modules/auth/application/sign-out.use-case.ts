import { Inject, Injectable } from "@nestjs/common";

import { SessionTokenPort } from "./ports/session-token.port";
import { SessionsRepositoryPort } from "./ports/sessions-repository.port";

/**
 * Ends the session behind a token. The caller is already authenticated by the
 * session guard; revocation is idempotent and server-side, so the JWT stops
 * working immediately even if a copy of it survives somewhere.
 */
@Injectable()
export class SignOutUseCase {
  constructor(
    @Inject(SessionTokenPort)
    private readonly tokens: SessionTokenPort,
    @Inject(SessionsRepositoryPort)
    private readonly sessions: SessionsRepositoryPort,
  ) {}

  async execute(token: string): Promise<void> {
    const claims = await this.tokens.verify(token);

    await this.sessions.revoke(claims.userId, claims.sessionId);
  }
}
