/** Raised when a prompt targets an Expert id that is not in the catalog. */
export class UnknownExpertError extends Error {
  constructor(readonly expertId: string) {
    super("Unknown Expert");
    this.name = "UnknownExpertError";
  }
}

/** Raised when the model cannot be reached or configured. Never carries a prompt. */
export class ModelUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("The Expert could not respond");
    this.name = "ModelUnavailableError";
    this.cause = cause;
  }
}
