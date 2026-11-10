/**
 * Unknown email, wrong password or malformed credentials. A single error type
 * (and a single public message) keeps the three cases indistinguishable.
 */
export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid credentials.");
    this.name = "InvalidCredentialsError";
  }
}

/**
 * The password is correct but the email was never confirmed. It is only thrown
 * after the password check, so it cannot reveal accounts to strangers.
 */
export class EmailNotConfirmedError extends Error {
  constructor() {
    super("Email not confirmed.");
    this.name = "EmailNotConfirmedError";
  }
}
