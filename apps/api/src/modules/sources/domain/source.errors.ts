import { ACCEPTED_ALL_SOURCE_FORMATS, ACCEPTED_SOURCE_FORMATS } from "./source";

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
  constructor(includeMedia = false) {
    super(
      "UNSUPPORTED_SOURCE_FILE",
      includeMedia
        ? `Only ${ACCEPTED_ALL_SOURCE_FORMATS} files are supported.`
        : `Only ${ACCEPTED_SOURCE_FORMATS} files are supported.`,
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

export class MediaDurationTooLongError extends SourceError {
  constructor() {
    super(
      "MEDIA_DURATION_TOO_LONG",
      "Media longer than 60 minutes is not supported. Try a shorter file.",
    );
  }
}

export class InvalidMediaDurationError extends SourceError {
  constructor() {
    super(
      "INVALID_MEDIA_DURATION",
      "Enter a valid duration in seconds, up to 60 minutes.",
    );
  }
}

export class NoSpeechDetectedError extends SourceError {
  constructor() {
    super("NO_SPEECH_DETECTED", "No speech detected");
  }
}

export class MediaExtractionUnavailableError extends SourceError {
  constructor() {
    super(
      "MEDIA_EXTRACTION_UNAVAILABLE",
      "Media text extraction is not configured on this server. Try again later.",
    );
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
