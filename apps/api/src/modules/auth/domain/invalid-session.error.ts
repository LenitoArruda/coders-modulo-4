/**
 * Raised when a session token is missing, malformed, expired, signed with the
 * wrong secret, or backed by a revoked/expired/unknown session. The interface
 * layer maps it to the standard 401 contract.
 */
export class InvalidSessionError extends Error {
  constructor() {
    super("Session is invalid or has expired");
    this.name = "InvalidSessionError";
  }
}
