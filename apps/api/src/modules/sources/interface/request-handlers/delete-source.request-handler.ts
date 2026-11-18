import { Controller, Delete, HttpCode, Param, UseGuards } from "@nestjs/common";

import { AuthUser } from "../../../auth/domain/auth-user";
import { CurrentUser } from "../../../auth/interface/current-user.decorator";
import { SessionGuard } from "../../../auth/interface/session.guard";
import { DeleteSourceUseCase } from "../../application/delete-source.use-case";
import { sourceHttpError } from "../source-error-response";

/** Deletes one source and all of its versions, chunks and vectors. */
@Controller("sources")
export class DeleteSourceRequestHandler {
  constructor(private readonly deleteSource: DeleteSourceUseCase) {}

  @Delete(":sourceId")
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async handle(
    @CurrentUser() user: AuthUser,
    @Param("sourceId") sourceId: string,
  ): Promise<void> {
    try {
      await this.deleteSource.execute(user.id, sourceId);
    } catch (error) {
      const httpError = sourceHttpError(error);

      if (httpError !== null) throw httpError;

      throw error;
    }
  }
}
