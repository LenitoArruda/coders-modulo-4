import { InvalidSessionError } from "../../modules/auth/domain/invalid-session.error";
import {
  SessionTokenPort,
  type SessionTokenClaims,
} from "../../modules/auth/application/ports/session-token.port";

/**
 * Deterministic fake for unit tests: signing produces an opaque token that
 * echoes the claims, and verification either returns the configured claims or
 * throws like the real adapter would.
 */
export class FakeSessionToken extends SessionTokenPort {
  readonly signed: SessionTokenClaims[] = [];

  /** Claims returned by `verify`; when set to an error, verify throws it. */
  verifyResult: SessionTokenClaims | InvalidSessionError | null = null;

  async sign(claims: SessionTokenClaims): Promise<string> {
    this.signed.push(claims);

    return `fake-token.${claims.sessionId}.${claims.userId}`;
  }

  async verify(token: string): Promise<SessionTokenClaims> {
    if (this.verifyResult instanceof InvalidSessionError) {
      throw this.verifyResult;
    }

    if (this.verifyResult) {
      return this.verifyResult;
    }

    const [prefix, sessionId, userId, ...rest] = token.split(".");

    if (
      prefix !== "fake-token" ||
      sessionId === undefined ||
      userId === undefined ||
      rest.length > 0
    ) {
      throw new InvalidSessionError();
    }

    return { sessionId, userId };
  }
}
