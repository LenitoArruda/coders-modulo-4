/**
 * Raised by the users repository when the unique email index rejects a
 * concurrent creation. The use case turns it into the resend/conflict flow.
 */
export class DuplicateEmailError extends Error {
  constructor() {
    super("Email already registered");
    this.name = "DuplicateEmailError";
  }
}

/** Raised when a sign-up targets an email that already has a confirmed account. */
export class EmailAlreadyConfirmedError extends Error {
  constructor() {
    super("Email already confirmed");
    this.name = "EmailAlreadyConfirmedError";
  }
}

/**
 * Raised when the confirmation email cannot be dispatched. The account stays
 * unconfirmed and can be reused by a new sign-up attempt.
 */
export class ConfirmationEmailDeliveryError extends Error {
  constructor(cause?: unknown) {
    super("Could not send the confirmation email");
    this.name = "ConfirmationEmailDeliveryError";
    this.cause = cause;
  }
}
