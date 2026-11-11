import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";

import {
  type ConfirmAccountResult,
  ConfirmAccountUseCase,
} from "../../application/confirm-account.use-case";
import {
  AccountAlreadyConfirmedError,
  InvalidConfirmationTokenError,
} from "../../domain/confirmation.errors";

import { clientIp } from "../client-ip";
import { ConfirmationRateLimiter } from "../confirmation-rate-limiter";
import { readConfirmationToken } from "../read-confirmation-token";

export type ConfirmAccountResponse = ConfirmAccountResult;

export const CONFIRM_INVALID_MESSAGE =
  "This confirmation link is invalid or has expired.";

export const CONFIRM_ALREADY_CONFIRMED_MESSAGE =
  "This account is already confirmed. Sign in instead.";

const CONFIRM_RATE_LIMIT_MESSAGE =
  "Too many attempts. Wait a moment and try again.";

@Controller("auth")
export class ConfirmAccountRequestHandler {
  constructor(
    @Inject(ConfirmAccountUseCase)
    private readonly confirmAccountUseCase: ConfirmAccountUseCase,
    @Inject(ConfirmationRateLimiter)
    private readonly confirmationLimiter: ConfirmationRateLimiter,
  ) {}

  @Post("confirm")
  @HttpCode(HttpStatus.OK)
  async handle(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ConfirmAccountResponse> {
    const decision = this.confirmationLimiter.consume(clientIp(request));

    if (!decision.allowed) {
      response.setHeader("Retry-After", String(decision.retryAfterSeconds));

      throw new HttpException(
        {
          code: "TOO_MANY_REQUESTS",
          message: CONFIRM_RATE_LIMIT_MESSAGE,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const token = readConfirmationToken(body);

    if (token === null) {
      throw new BadRequestException({
        code: "INVALID_CONFIRMATION_TOKEN",
        message: CONFIRM_INVALID_MESSAGE,
      });
    }

    try {
      return await this.confirmAccountUseCase.execute(token);
    } catch (error) {
      if (error instanceof InvalidConfirmationTokenError) {
        throw new BadRequestException({
          code: "INVALID_CONFIRMATION_TOKEN",
          message: CONFIRM_INVALID_MESSAGE,
        });
      }

      if (error instanceof AccountAlreadyConfirmedError) {
        throw new HttpException(
          {
            code: "ACCOUNT_ALREADY_CONFIRMED",
            message: CONFIRM_ALREADY_CONFIRMED_MESSAGE,
          },
          HttpStatus.CONFLICT,
        );
      }

      throw error;
    }
  }
}
