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

import { ResetPasswordUseCase } from "../../application/reset-password.use-case";
import { InvalidResetTokenError } from "../../domain/reset-password.errors";
import { validateResetPasswordInput } from "../../domain/reset-password-input";

import { clientIp } from "../client-ip";
import { ResetPasswordRateLimiter } from "../reset-password-rate-limiter";

export type ResetPasswordResponse = { message: string };

export const RESET_PASSWORD_SUCCESS_MESSAGE =
  "Your password has been updated. Sign in with your new password.";

export const RESET_PASSWORD_INVALID_TOKEN_MESSAGE =
  "This password reset link is invalid or has expired.";

const RESET_PASSWORD_VALIDATION_MESSAGE =
  "Check the highlighted fields and try again.";
const RESET_PASSWORD_RATE_LIMIT_MESSAGE =
  "Too many attempts. Wait a moment and try again.";

@Controller("auth")
export class ResetPasswordRequestHandler {
  constructor(
    @Inject(ResetPasswordUseCase)
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
    @Inject(ResetPasswordRateLimiter)
    private readonly resetPasswordLimiter: ResetPasswordRateLimiter,
  ) {}

  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  async handle(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ResetPasswordResponse> {
    const decision = this.resetPasswordLimiter.consume(clientIp(request));

    if (!decision.allowed) {
      response.setHeader("Retry-After", String(decision.retryAfterSeconds));

      throw new HttpException(
        {
          code: "TOO_MANY_REQUESTS",
          message: RESET_PASSWORD_RATE_LIMIT_MESSAGE,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Password and confirmation are validated before the token is looked up,
    // so a weak password never burns the token and wins over an invalid one.
    const validation = validateResetPasswordInput(body);

    if (!validation.ok) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: RESET_PASSWORD_VALIDATION_MESSAGE,
        fieldErrors: validation.fieldErrors,
      });
    }

    try {
      await this.resetPasswordUseCase.execute(validation.value);
    } catch (error) {
      if (error instanceof InvalidResetTokenError) {
        throw new BadRequestException({
          code: "INVALID_RESET_TOKEN",
          message: RESET_PASSWORD_INVALID_TOKEN_MESSAGE,
        });
      }

      throw error;
    }

    return { message: RESET_PASSWORD_SUCCESS_MESSAGE };
  }
}
