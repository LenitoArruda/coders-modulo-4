import type { Session, SessionOrigin } from "../../domain/session";

export type SessionCreation = {
  userId: string;
  origin: SessionOrigin;
  expiresAt: Date;
};

export abstract class SessionsRepositoryPort {
  /** Persists a new session row and returns it with its generated id. */
  abstract create(creation: SessionCreation): Promise<Session>;

  /**
   * Revokes every active session of the user except `keepSessionId`.
   * Required for the single-session policy; must never revive a session.
   */
  abstract revokeAllActiveExcept(
    userId: string,
    keepSessionId: string,
  ): Promise<void>;

  /**
   * Revokes every active session of the user, with no exception. Used after a
   * password reset: no previous session may survive it. Never revives one.
   */
  abstract revokeAllActive(userId: string): Promise<void>;

  /**
   * Revokes one session of the user (sign-out). Idempotent: an unknown,
   * already revoked or expired session is a no-op. Never revives a session.
   */
  abstract revoke(userId: string, sessionId: string): Promise<void>;

  /**
   * Returns the session only when it is active: not revoked and not expired.
   * A valid JWT signature is not enough to consider a session valid.
   */
  abstract findActiveById(sessionId: string): Promise<Session | null>;
}
