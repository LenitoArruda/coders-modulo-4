import { Controller, Get, Inject, UseGuards } from "@nestjs/common";

import { SessionGuard } from "../../../auth/interface/session.guard";
import {
  ListExpertsUseCase,
  type ExpertListResponse,
} from "../../application/list-experts.use-case";

/** Authenticated catalog endpoint. The web reads it on the server. */
@Controller("experts")
export class ListExpertsRequestHandler {
  constructor(
    @Inject(ListExpertsUseCase)
    private readonly listExperts: ListExpertsUseCase,
  ) {}

  @Get()
  @UseGuards(SessionGuard)
  handle(): ExpertListResponse {
    return this.listExperts.execute();
  }
}
