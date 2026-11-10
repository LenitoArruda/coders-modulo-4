import { Inject, Injectable } from "@nestjs/common";

import { log } from "../../shared/observability/app-logger";
import { SESSION_TTL_SECONDS } from "../auth.tokens";
import type { AuthUser } from "../domain/auth-user";
import type { Session, SessionOrigin } from "../domain/session";

import { buildNewSessionEmail } from "./new-session-email";
import { EmailSenderPort } from "./ports/email-sender.port";
import { SessionTokenPort } from "./ports/session-token.port";
import { SessionsRepositoryPort } from "./ports/sessions-repository.port";

export type CreateSessionInput = {
  user: AuthUser;
  origin: SessionOrigin;
};

export type CreatedSession = {
  token: string;
  session: Session;
};

const EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/g;

/** Email delivery failures are logged without PII: addresses are masked. */
function redactEmails(value: string): string {
  return value.replaceAll(EMAIL_PATTERN, "[redacted-email]");
}

/**
 * Internal use case that issues a session for a user. It enforces the
 * single-session policy: after it succeeds, only the new session is valid.
 *
 * The new session row is created before the previous ones are revoked (with
 * the new id excluded from the update). With autocommitted statements this is
 * the only order that keeps the invariant under concurrent creations: the
 * last revocation always removes everything except its own session, so two
 * simultaneous creations can never leave two active sessions (the worst case
 * leaves both revoked, requiring a new sign-in).
 */
@Injectable()
export class CreateSessionUseCase {
  constructor(
    @Inject(SessionsRepositoryPort)
    private readonly sessions: SessionsRepositoryPort,
    @Inject(SessionTokenPort)
    private readonly tokens: SessionTokenPort,
    @Inject(EmailSenderPort)
    private readonly emails: EmailSenderPort,
    @Inject(SESSION_TTL_SECONDS)
    private readonly ttlSeconds: number,
  ) {}

  async execute(input: CreateSessionInput): Promise<CreatedSession> {
    const expiresAt = new Date(Date.now() + this.ttlSeconds * 1000);
    const session = await this.sessions.create({
      userId: input.user.id,
      origin: input.origin,
      expiresAt,
    });

    await this.sessions.revokeAllActiveExcept(input.user.id, session.id);

    const token = await this.tokens.sign({
      userId: input.user.id,
      sessionId: session.id,
    });

    try {
      await this.emails.send(
        buildNewSessionEmail(input.user, session.createdAt),
      );
    } catch (error) {
      // A failed notification must never block the session.
      log("warn", "E-mail de nova sessão não foi enviado", {
        userId: input.user.id,
        sessionId: session.id,
        error: redactEmails(
          error instanceof Error
            ? `${error.name}: ${error.message}`
            : "unknown",
        ),
      });
    }

    return { token, session };
  }
}
