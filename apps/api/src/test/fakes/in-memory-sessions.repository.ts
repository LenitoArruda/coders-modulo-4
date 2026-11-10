import { randomUUID } from "node:crypto";

import type { Session, SessionOrigin } from "../../modules/auth/domain/session";
import {
  SessionsRepositoryPort,
  type SessionCreation,
} from "../../modules/auth/application/ports/sessions-repository.port";

type StoredSession = Session;

/**
 * In-memory fake used by unit and integration tests. Mirrors the real
 * repository semantics: active means `revokedAt === null` and not expired,
 * and revocation is permanent.
 */
export class InMemorySessionsRepository extends SessionsRepositoryPort {
  readonly sessions: StoredSession[] = [];

  async create(creation: SessionCreation): Promise<Session> {
    const session: Session = {
      id: randomUUID(),
      userId: creation.userId,
      origin: creation.origin,
      createdAt: new Date(),
      expiresAt: creation.expiresAt,
      revokedAt: null,
    };

    this.sessions.push(session);

    return session;
  }

  async revokeAllActiveExcept(
    userId: string,
    keepSessionId: string,
  ): Promise<void> {
    const now = new Date();

    for (const session of this.sessions) {
      if (
        session.userId === userId &&
        session.id !== keepSessionId &&
        session.revokedAt === null &&
        session.expiresAt.getTime() > now.getTime()
      ) {
        session.revokedAt = now;
      }
    }
  }

  async revokeAllActive(userId: string): Promise<void> {
    const now = new Date();

    for (const session of this.sessions) {
      if (
        session.userId === userId &&
        session.revokedAt === null &&
        session.expiresAt.getTime() > now.getTime()
      ) {
        session.revokedAt = now;
      }
    }
  }

  async findActiveById(sessionId: string): Promise<Session | null> {
    const session = this.sessions.find(
      (candidate) => candidate.id === sessionId,
    );

    if (!session || session.revokedAt !== null) {
      return null;
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    return session;
  }

  /** Test helper that bypasses the port to seed arbitrary sessions. */
  seed(session: Omit<Session, "id"> & { id?: string }): Session {
    const stored: Session = {
      id: session.id ?? randomUUID(),
      userId: session.userId,
      origin: session.origin,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
    };

    this.sessions.push(stored);

    return stored;
  }
}

export function activeSession(
  userId: string,
  origin: SessionOrigin = "sign_in",
): Omit<Session, "id"> {
  return {
    userId,
    origin,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 3_600_000),
    revokedAt: null,
  };
}
