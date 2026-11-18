import { Controller, Get, Param, UseGuards } from "@nestjs/common";

import { AuthUser } from "../../../auth/domain/auth-user";
import { CurrentUser } from "../../../auth/interface/current-user.decorator";
import { SessionGuard } from "../../../auth/interface/session.guard";
import { GetMediaStatusUseCase } from "../../application/get-media-status.use-case";
import type { MediaAttachment } from "../../domain/media";
import { MediaFlagGuard } from "../media-flag.guard";
import { throwMediaHttpError } from "../media-error-response";

/** Returns pollable status and public metadata for one owned deliverable. */
@Controller("media")
@UseGuards(SessionGuard, MediaFlagGuard)
export class GetMediaStatusRequestHandler {
  constructor(private readonly getStatus: GetMediaStatusUseCase) {}

  @Get(":mediaId/status")
  async handle(
    @CurrentUser() user: AuthUser,
    @Param("mediaId") mediaId: string,
  ): Promise<MediaAttachment> {
    try {
      return await this.getStatus.execute(mediaId, user.id);
    } catch (error) {
      throwMediaHttpError(error);
    }
  }
}
