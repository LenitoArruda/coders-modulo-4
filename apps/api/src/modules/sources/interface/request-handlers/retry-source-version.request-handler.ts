import { Controller, HttpCode, Param, Post, UseGuards } from "@nestjs/common";

import type { AuthUser } from "../../../auth/domain/auth-user";
import { CurrentUser } from "../../../auth/interface/current-user.decorator";
import { SessionGuard } from "../../../auth/interface/session.guard";
import {
  RetrySourceVersionUseCase,
  type RetrySourceVersionResult,
} from "../../application/retry-source-version.use-case";
import { sourceHttpError } from "../source-error-response";

/** Retries one failed version after clearing partial vector writes. */
@Controller("sources")
export class RetrySourceVersionRequestHandler {
  constructor(private readonly retryVersion: RetrySourceVersionUseCase) {}

  @Post(":versionId/retry")
  @HttpCode(202)
  @UseGuards(SessionGuard)
  async handle(
    @CurrentUser() user: AuthUser,
    @Param("versionId") versionId: string,
  ): Promise<RetrySourceVersionResult> {
    try {
      return await this.retryVersion.execute(user.id, versionId);
    } catch (error) {
      const httpError = sourceHttpError(error);

      if (httpError !== null) throw httpError;

      throw error;
    }
  }
}
