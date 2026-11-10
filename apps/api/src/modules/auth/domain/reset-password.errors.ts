/**
 * The reset token is missing, unknown, expired, already used, or was consumed
 * by a concurrent request. The message is internal only; controllers map it to
 * the public `INVALID_RESET_TOKEN` contract.
 */
export class InvalidResetTokenError extends Error {
  constructor() {
    super("Invalid reset token.");
    this.name = "InvalidResetTokenError";
  }
}
