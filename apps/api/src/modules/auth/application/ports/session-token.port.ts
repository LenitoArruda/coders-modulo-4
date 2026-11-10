export type SessionTokenClaims = {
  userId: string;
  sessionId: string;
};

export abstract class SessionTokenPort {
  /**
   * Signs a JWT containing only `sub`, `sid`, `iat` and `exp`, where `exp` is
   * the configured session duration away from `iat`.
   */
  abstract sign(claims: SessionTokenClaims): Promise<string>;

  /**
   * Verifies signature and expiration. Anything else — including whether the
   * session is still active — is checked by the use cases against the session
   * registry. Throws `InvalidSessionError` on failure.
   */
  abstract verify(token: string): Promise<SessionTokenClaims>;
}
