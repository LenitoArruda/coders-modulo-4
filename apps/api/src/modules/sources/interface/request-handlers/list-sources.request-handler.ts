import { Controller, Get, UseGuards } from "@nestjs/common";

import type { AuthUser } from "../../../auth/domain/auth-user";
import { CurrentUser } from "../../../auth/interface/current-user.decorator";
import { SessionGuard } from "../../../auth/interface/session.guard";
import {
  ListSourcesUseCase,
  type ListSourcesResult,
} from "../../application/list-sources.use-case";

/** Returns the authenticated user's connected sources. */
@Controller("sources")
export class ListSourcesRequestHandler {
  constructor(private readonly listSources: ListSourcesUseCase) {}

  @Get()
  @UseGuards(SessionGuard)
  async handle(@CurrentUser() user: AuthUser): Promise<ListSourcesResult> {
    return this.listSources.execute(user.id);
  }
}
