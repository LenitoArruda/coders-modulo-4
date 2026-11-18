import { MEDIA_MESSAGES, type MediaErrorCode } from "./media";

/** Base class for expected media failures; details never include prompts. */
export abstract class MediaError extends Error {
  abstract readonly code: MediaErrorCode;
  readonly publicMessage: string;

  constructor(publicMessage: string, cause?: unknown) {
    super(publicMessage);
    this.name = "MediaError";
    this.publicMessage = publicMessage;
    this.cause = cause;
  }
}

export class MediaLimitError extends MediaError {
  readonly code = "LIMIT_EXCEEDED";

  constructor(message: string = MEDIA_MESSAGES.briefingTooLong) {
    super(message);
    this.name = "MediaLimitError";
  }
}

export class MediaQuotaError extends MediaError {
  readonly code = "QUOTA_EXCEEDED";

  constructor() {
    super(MEDIA_MESSAGES.quota);
    this.name = "MediaQuotaError";
  }
}

export class MediaProviderError extends MediaError {
  readonly code = "PROVIDER_UNAVAILABLE";

  constructor(cause?: unknown, message: string = MEDIA_MESSAGES.unavailable) {
    super(message, cause);
    this.name = "MediaProviderError";
  }
}

export class MediaContentRefusedError extends MediaError {
  readonly code = "CONTENT_REFUSED";

  constructor() {
    super(MEDIA_MESSAGES.refused);
    this.name = "MediaContentRefusedError";
  }
}

export class MediaNotFoundError extends MediaError {
  readonly code = "NOT_FOUND";

  constructor() {
    super(MEDIA_MESSAGES.notFound);
    this.name = "MediaNotFoundError";
  }
}
