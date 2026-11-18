import { Controller, Param, Post, UseGuards } from "@nestjs/common";

import { AuthUser } from "../../../auth/domain/auth-user";
import { CurrentUser } from "../../../auth/interface/current-user.decorator";
import { SessionGuard } from "../../../auth/interface/session.guard";
import { RetryMediaGenerationUseCase } from "../../application/retry-media-generation.use-case";
import type { MediaAttachment } from "../../domain/media";
import { MediaFlagGuard } from "../media-flag.guard";
import { throwMediaHttpError } from "../media-error-response";

/** Reuses a failed deliverable's validated parameters for up to 3 attempts. */
@Controller("media")
@UseGuards(SessionGuard, MediaFlagGuard)
export class RetryMediaGenerationRequestHandler {
  constructor(private readonly retry: RetryMediaGenerationUseCase) {}

  @Post(":mediaId/retry")
  async handle(
    @CurrentUser() user: AuthUser,
    @Param("mediaId") mediaId: string,
  ): Promise<MediaAttachment> {
    try {
      return await this.retry.execute(mediaId, user.id);
    } catch (error) {
      throwMediaHttpError(error);
    }
  }
}
