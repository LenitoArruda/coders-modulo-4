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

import { RequestPasswordResetUseCase } from "../../application/request-password-reset.use-case";
import { validateForgotPasswordInput } from "../../domain/forgot-password-input";

import { clientIp } from "../client-ip";
import { ForgotPasswordRateLimiter } from "../forgot-password-rate-limiter";

export type ForgotPasswordResponse = { message: string };

/**
 * Same body and status for every syntactically valid email, whether or not an
 * account exists, so the endpoint cannot be used to enumerate accounts.
 */
export const FORGOT_PASSWORD_SUCCESS_MESSAGE =
  "If an account exists for this email, we sent a password reset link.";

const FORGOT_PASSWORD_VALIDATION_MESSAGE =
  "Check the highlighted fields and try again.";
const FORGOT_PASSWORD_RATE_LIMIT_MESSAGE =
  "Too many attempts. Wait a moment and try again.";

@Controller("auth")
export class RequestPasswordResetRequestHandler {
  constructor(
    @Inject(RequestPasswordResetUseCase)
    private readonly requestPasswordReset: RequestPasswordResetUseCase,
    @Inject(ForgotPasswordRateLimiter)
    private readonly forgotPasswordRateLimiter: ForgotPasswordRateLimiter,
  ) {}

  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  async handle(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ForgotPasswordResponse> {
    const ipDecision = this.forgotPasswordRateLimiter.consume(
      `ip:${clientIp(request)}`,
    );

    if (!ipDecision.allowed) {
      response.setHeader("Retry-After", String(ipDecision.retryAfterSeconds));

      throw new HttpException(
        {
          code: "TOO_MANY_REQUESTS",
          message: FORGOT_PASSWORD_RATE_LIMIT_MESSAGE,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const validation = validateForgotPasswordInput(body);

    if (!validation.ok) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: FORGOT_PASSWORD_VALIDATION_MESSAGE,
        fieldErrors: validation.fieldErrors,
      });
    }

    const emailDecision = this.forgotPasswordRateLimiter.consume(
      `email:${validation.value.email}`,
    );

    if (!emailDecision.allowed) {
      response.setHeader(
        "Retry-After",
        String(emailDecision.retryAfterSeconds),
      );

      throw new HttpException(
        {
          code: "TOO_MANY_REQUESTS",
          message: FORGOT_PASSWORD_RATE_LIMIT_MESSAGE,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.requestPasswordReset.execute(validation.value);

    return { message: FORGOT_PASSWORD_SUCCESS_MESSAGE };
  }
}
