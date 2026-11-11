import {
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";

import { SignOutUseCase } from "../../application/sign-out.use-case";

import { SessionGuard, extractBearerToken } from "../session.guard";

@Controller("auth")
export class SignOutRequestHandler {
  constructor(
    @Inject(SignOutUseCase)
    private readonly signOutUseCase: SignOutUseCase,
  ) {}

  /** Revokes the caller's current session; the JWT stops working at once. */
  @Post("sign-out")
  @UseGuards(SessionGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async handle(@Req() request: Request): Promise<void> {
    const token = extractBearerToken(request.headers.authorization);

    // The guard already rejected a missing token.
    if (token !== null) {
      await this.signOutUseCase.execute(token);
    }
  }
}
