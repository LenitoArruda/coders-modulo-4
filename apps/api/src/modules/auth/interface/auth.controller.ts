import { Controller, Get, UseGuards } from "@nestjs/common";

import type { AuthUser } from "../domain/auth-user";

import { CurrentUser } from "./current-user.decorator";
import { SessionGuard } from "./session.guard";

export type MeResponse = { user: AuthUser };

@Controller("auth")
@UseGuards(SessionGuard)
export class AuthController {
  @Get("me")
  me(@CurrentUser() user: AuthUser): MeResponse {
    return { user };
  }
}
