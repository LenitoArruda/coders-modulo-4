import { Inject, Injectable } from "@nestjs/common";
import { SignJWT, jwtVerify } from "jose";

import {
  SessionTokenPort,
  type SessionTokenClaims,
} from "../application/ports/session-token.port";
import { JWT_SECRET, SESSION_TTL_SECONDS } from "../auth.tokens";
import { InvalidSessionError } from "../domain/invalid-session.error";

const ALGORITHM = "HS256";

/**
 * HS256 JWT adapter backed by `jose`. Tokens carry only the user id (`sub`),
 * the session id (`sid`), the issue time (`iat`) and the expiration (`exp`),
 * where `exp = iat + SESSION_TTL_SECONDS`. Verification failures of any kind
 * are normalized to `InvalidSessionError` so callers never branch on library
 * details.
 */
@Injectable()
export class JoseSessionTokenAdapter extends SessionTokenPort {
  private readonly key: Uint8Array;

  constructor(
    @Inject(JWT_SECRET) secret: string,
    @Inject(SESSION_TTL_SECONDS) private readonly ttlSeconds: number,
  ) {
    super();
    this.key = new TextEncoder().encode(secret);
  }

  async sign(claims: SessionTokenClaims): Promise<string> {
    const issuedAt = Math.floor(Date.now() / 1000);

    return new SignJWT({ sid: claims.sessionId })
      .setProtectedHeader({ alg: ALGORITHM })
      .setSubject(claims.userId)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + this.ttlSeconds)
      .sign(this.key);
  }

  async verify(token: string): Promise<SessionTokenClaims> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: [ALGORITHM],
      });

      if (typeof payload.sub !== "string" || typeof payload.sid !== "string") {
        throw new InvalidSessionError();
      }

      return { userId: payload.sub, sessionId: payload.sid };
    } catch {
      throw new InvalidSessionError();
    }
  }
}
