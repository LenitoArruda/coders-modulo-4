import { Controller, Get, Param, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";

import { AuthUser } from "../../../auth/domain/auth-user";
import { CurrentUser } from "../../../auth/interface/current-user.decorator";
import { SessionGuard } from "../../../auth/interface/session.guard";
import { DownloadMediaUseCase } from "../../application/download-media.use-case";
import { MediaFlagGuard } from "../media-flag.guard";
import { throwMediaHttpError } from "../media-error-response";

/** Streams ready bytes with a safe, fixed download filename. */
@Controller("media")
@UseGuards(SessionGuard, MediaFlagGuard)
export class DownloadMediaRequestHandler {
  constructor(private readonly download: DownloadMediaUseCase) {}

  @Get(":mediaId/content")
  async handle(
    @CurrentUser() user: AuthUser,
    @Param("mediaId") mediaId: string,
    @Res() response: Response,
  ): Promise<void> {
    let file: Awaited<ReturnType<DownloadMediaUseCase["execute"]>>;
    try {
      file = await this.download.execute(mediaId, user.id);
    } catch (error) {
      throwMediaHttpError(error);
    }

    response.setHeader("Content-Type", file.mimeType);
    response.setHeader("Content-Length", String(file.bytes.byteLength));
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${file.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
    );
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.send(file.bytes);
  }
}
