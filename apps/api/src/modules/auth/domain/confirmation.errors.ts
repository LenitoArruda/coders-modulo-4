/**
 * The confirmation token is missing, unknown, expired, already used, or was
 * consumed by a concurrent request. The message is internal only; controllers
 * map it to the public `INVALID_CONFIRMATION_TOKEN` contract.
 */
export class InvalidConfirmationTokenError extends Error {
  constructor() {
    super("Invalid confirmation token.");
    this.name = "InvalidConfirmationTokenError";
  }
}

/**
 * The account is already confirmed. A second confirmation must not create a
 * new session nor overwrite `email_confirmed_at`.
 */
export class AccountAlreadyConfirmedError extends Error {
  constructor() {
    super("Account already confirmed.");
    this.name = "AccountAlreadyConfirmedError";
  }
}
