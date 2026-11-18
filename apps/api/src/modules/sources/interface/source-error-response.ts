import {
  BadRequestException,
  HttpException,
  HttpStatus,
  NotFoundException,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from "@nestjs/common";

import {
  EmptySourceFileError,
  InvalidMediaDurationError,
  MediaDurationTooLongError,
  SourceError,
  SourceFileTooLargeError,
  SourceNotFoundError,
  SourceVersionNotFoundError,
  TooManySourceFilesError,
  UnsupportedSourceFileError,
} from "../domain/source.errors";

/** Maps public source errors to the global `{ code, message }` contract. */
export function sourceHttpError(error: unknown): HttpException | null {
  if (!(error instanceof SourceError)) return null;

  if (
    error instanceof UnsupportedSourceFileError ||
    error instanceof TooManySourceFilesError ||
    error instanceof MediaDurationTooLongError ||
    error instanceof InvalidMediaDurationError
  ) {
    return new BadRequestException({
      code: error.code,
      message: error.message,
    });
  }
  if (error instanceof SourceFileTooLargeError) {
    return new PayloadTooLargeException({
      code: error.code,
      message: error.message,
    });
  }
  if (error instanceof EmptySourceFileError) {
    return new UnprocessableEntityException({
      code: error.code,
      message: error.message,
    });
  }
  if (
    error instanceof SourceNotFoundError ||
    error instanceof SourceVersionNotFoundError
  ) {
    return new NotFoundException({ code: error.code, message: error.message });
  }

  return new HttpException(
    { code: error.code, message: error.message },
    HttpStatus.SERVICE_UNAVAILABLE,
  );
}
