import { Controller, Param, Post, UseGuards } from "@nestjs/common";

import { AuthUser } from "../../../auth/domain/auth-user";
import { CurrentUser } from "../../../auth/interface/current-user.decorator";
import { SessionGuard } from "../../../auth/interface/session.guard";
import { CancelMediaGenerationUseCase } from "../../application/cancel-media-generation.use-case";
import type { MediaAttachment } from "../../domain/media";
import { MediaFlagGuard } from "../media-flag.guard";
import { throwMediaHttpError } from "../media-error-response";

/** Cancels an owned job; queued jobs refund quota and drop partial bytes. */
@Controller("media")
@UseGuards(SessionGuard, MediaFlagGuard)
export class CancelMediaGenerationRequestHandler {
  constructor(private readonly cancel: CancelMediaGenerationUseCase) {}

  @Post(":mediaId/cancel")
  async handle(
    @CurrentUser() user: AuthUser,
    @Param("mediaId") mediaId: string,
  ): Promise<MediaAttachment> {
    try {
      return await this.cancel.execute(mediaId, user.id);
    } catch (error) {
      throwMediaHttpError(error);
    }
  }
}
