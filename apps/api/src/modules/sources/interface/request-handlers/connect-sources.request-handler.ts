import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  UploadedFiles,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";

import { AuthUser } from "../../../auth/domain/auth-user";
import { CurrentUser } from "../../../auth/interface/current-user.decorator";
import { SessionGuard } from "../../../auth/interface/session.guard";
import {
  ConnectSourcesUseCase,
  type ConnectSourcesResult,
} from "../../application/connect-sources.use-case";
import {
  MAX_FILES_PER_UPLOAD,
  validateDurationSeconds,
  validateSourceFiles,
} from "../../domain/source-file-policy";
import { SOURCE_MEDIA_ENABLED } from "../../sources.tokens";
import { sourceHttpError } from "../source-error-response";
import { SourceUploadExceptionFilter } from "../source-upload.exception-filter";

type MultipartBody = { durationSeconds?: string | number };

/** Accepts up to five supported files and starts async indexing. */
@Controller("sources")
@UseFilters(SourceUploadExceptionFilter)
export class ConnectSourcesRequestHandler {
  constructor(
    private readonly connectSources: ConnectSourcesUseCase,
    @Inject(SOURCE_MEDIA_ENABLED) private readonly mediaEnabled: boolean,
  ) {}

  @Post()
  @HttpCode(202)
  @UseGuards(SessionGuard)
  @UseInterceptors(FilesInterceptor("files", MAX_FILES_PER_UPLOAD))
  async handle(
    @CurrentUser() user: AuthUser,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: MultipartBody,
  ): Promise<ConnectSourcesResult> {
    try {
      const durationSeconds = validateDurationSeconds(body?.durationSeconds);
      const validated = validateSourceFiles(
        (files ?? []).map((file) => ({
          originalName: file.originalname,
          mimeType: file.mimetype,
          buffer: file.buffer,
          durationSeconds,
        })),
        undefined,
        undefined,
        { allowMedia: this.mediaEnabled },
      );

      return await this.connectSources.execute({
        userId: user.id,
        files: validated,
      });
    } catch (error) {
      const httpError = sourceHttpError(error);

      if (httpError !== null) throw httpError;

      throw error;
    }
  }
}
