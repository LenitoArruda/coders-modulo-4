import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";

import type { AuthUser } from "../../../auth/domain/auth-user";
import { CurrentUser } from "../../../auth/interface/current-user.decorator";
import { SessionGuard } from "../../../auth/interface/session.guard";
import { ConnectSourceUrlUseCase } from "../../application/connect-source-url.use-case";
import type { ConnectSourcesResult } from "../../application/connect-sources.use-case";
import { InvalidSourceUrlError } from "../../domain/source.errors";
import { sourceHttpError } from "../source-error-response";

type ConnectSourceUrlBody = { url?: unknown };

/** One endpoint, one use case: registers one public page by URL. */
@Controller("sources")
export class ConnectSourceUrlRequestHandler {
  constructor(private readonly connectSourceUrl: ConnectSourceUrlUseCase) {}

  @Post("urls")
  @HttpCode(202)
  @UseGuards(SessionGuard)
  async handle(
    @CurrentUser() user: AuthUser,
    @Body() body: ConnectSourceUrlBody,
  ): Promise<ConnectSourcesResult> {
    try {
      if (typeof body?.url !== "string") throw new InvalidSourceUrlError();

      return await this.connectSourceUrl.execute({
        userId: user.id,
        url: body.url,
      });
    } catch (error) {
      const httpError = sourceHttpError(error);

      if (httpError !== null) throw httpError;

      throw error;
    }
  }
}
