import { BadRequestException, NotFoundException } from "@nestjs/common";

import { MediaLimitError, MediaNotFoundError } from "../domain/media.errors";

/** Maps domain errors to stable public HTTP responses without leaking details. */
export function throwMediaHttpError(error: unknown): never {
  if (error instanceof MediaNotFoundError) {
    throw new NotFoundException({
      code: "MEDIA_NOT_FOUND",
      message: error.publicMessage,
    });
  }
  if (error instanceof MediaLimitError) {
    throw new BadRequestException({
      code: "MEDIA_LIMIT_EXCEEDED",
      message: error.publicMessage,
    });
  }
  throw error;
}
