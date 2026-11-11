import { Controller, Get, Inject, UseGuards } from "@nestjs/common";

import { GetCurrentUserUseCase } from "../../application/get-current-user.use-case";
import type { AuthUser } from "../../domain/auth-user";

import { CurrentUser } from "../current-user.decorator";
import { SessionGuard } from "../session.guard";

export type MeResponse = { user: AuthUser };

@Controller("auth")
export class GetCurrentUserRequestHandler {
  constructor(
    @Inject(GetCurrentUserUseCase)
    private readonly getCurrentUser: GetCurrentUserUseCase,
  ) {}

  @Get("me")
  @UseGuards(SessionGuard)
  handle(@CurrentUser() user: AuthUser): MeResponse {
    return { user: this.getCurrentUser.execute(user) };
  }
}
