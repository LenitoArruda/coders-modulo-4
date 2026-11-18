import { ACCEPTED_SOURCE_FORMATS } from "./source";

/** Base class for failures with an actionable, en-US public message. */
export class SourceError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class UnsupportedSourceFileError extends SourceError {
  constructor() {
    super(
      "UNSUPPORTED_SOURCE_FILE",
      `Only ${ACCEPTED_SOURCE_FORMATS} files are supported.`,
    );
  }
}

export class SourceFileTooLargeError extends SourceError {
  constructor() {
    super(
      "SOURCE_FILE_TOO_LARGE",
      "One of the files is too large. Try a smaller file.",
    );
  }
}

export class TooManySourceFilesError extends SourceError {
  constructor() {
    super(
      "TOO_MANY_SOURCE_FILES",
      "Too many files. Send up to 5 files at a time.",
    );
  }
}

export class EmptySourceFileError extends SourceError {
  constructor() {
    super("EMPTY_SOURCE_FILE", "The file has no text we can index.");
  }
}

export class SourceProcessingError extends SourceError {
  constructor() {
    super(
      "SOURCE_PROCESSING_FAILED",
      "We could not index this file. Try again in a moment.",
    );
  }
}

export class SourceVectorStoreError extends SourceError {
  constructor() {
    super(
      "SOURCE_VECTOR_STORE_UNAVAILABLE",
      "The knowledge index is unavailable. Try again in a moment.",
    );
  }
}

export class SourceEmbeddingError extends SourceError {
  constructor() {
    super(
      "SOURCE_EMBEDDING_UNAVAILABLE",
      "We could not create embeddings right now. Try again in a moment.",
    );
  }
}

export class SourceNotFoundError extends SourceError {
  constructor() {
    super("SOURCE_NOT_FOUND", "That source is no longer available.");
  }
}

export class SourceVersionNotFoundError extends SourceError {
  constructor() {
    super("SOURCE_VERSION_NOT_FOUND", "That version is no longer available.");
  }
}

export class InvalidSourceUrlError extends SourceError {
  constructor() {
    super(
      "INVALID_SOURCE_URL",
      "Enter a valid public HTTP or HTTPS URL (255 characters or fewer).",
    );
  }
}

export class BlockedSourceUrlError extends SourceError {
  constructor() {
    super(
      "BLOCKED_SOURCE_URL",
      "That address is not allowed. Use a public HTTP or HTTPS link.",
    );
  }
}

export class SourceUrlUnavailableError extends SourceError {
  constructor() {
    super(
      "SOURCE_URL_UNAVAILABLE",
      "We could not load that page. Check the address and try again.",
    );
  }
}

export class SourceUrlNoTextError extends SourceError {
  constructor() {
    super(
      "SOURCE_URL_NO_TEXT",
      "That page has no text we can index. Try another URL or upload a file.",
    );
  }
}

export class SourceUrlTooLargeError extends SourceError {
  constructor() {
    super(
      "SOURCE_URL_TOO_LARGE",
      "That page is too large to index. Try another URL or upload a file.",
    );
  }
}
