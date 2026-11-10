import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";

import { RequestPasswordResetUseCase } from "../application/request-password-reset.use-case";
import { SignUpUseCase } from "../application/sign-up.use-case";
import type { AuthUser } from "../domain/auth-user";
import { validateForgotPasswordInput } from "../domain/forgot-password-input";
import { validateSignUpInput } from "../domain/sign-up-input";
import {
  ConfirmationEmailDeliveryError,
  EmailAlreadyConfirmedError,
} from "../domain/sign-up.errors";

import { CurrentUser } from "./current-user.decorator";
import { ForgotPasswordRateLimiter } from "./forgot-password-rate-limiter";
import { SessionGuard } from "./session.guard";
import { SignUpRateLimiter } from "./sign-up-rate-limiter";

export type MeResponse = { user: AuthUser };

export type SignUpResponse = {
  message: string;
  user?: AuthUser;
};

export const SIGN_UP_SUCCESS_MESSAGE =
  "Check your email to confirm your account.";

export const SIGN_UP_CONFLICT_MESSAGE =
  "An account with this email already exists. Sign in instead.";

const SIGN_UP_VALIDATION_MESSAGE =
  "Check the highlighted fields and try again.";
const SIGN_UP_RATE_LIMIT_MESSAGE =
  "Too many attempts. Wait a moment and try again.";
const SIGN_UP_EMAIL_FAILURE_MESSAGE =
  "We could not send the confirmation email. Try again in a moment.";

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

function clientIp(request: Request): string {
  return request.ip ?? request.socket.remoteAddress ?? "unknown";
}

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(SignUpUseCase) private readonly signUp: SignUpUseCase,
    @Inject(SignUpRateLimiter)
    private readonly rateLimiter: SignUpRateLimiter,
    @Inject(RequestPasswordResetUseCase)
    private readonly requestPasswordReset: RequestPasswordResetUseCase,
    @Inject(ForgotPasswordRateLimiter)
    private readonly forgotPasswordRateLimiter: ForgotPasswordRateLimiter,
  ) {}

  @Post("sign-up")
  async createAccount(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SignUpResponse> {
    const decision = this.rateLimiter.consume(clientIp(request));

    if (!decision.allowed) {
      response.setHeader("Retry-After", String(decision.retryAfterSeconds));

      throw new HttpException(
        {
          code: "TOO_MANY_REQUESTS",
          message: SIGN_UP_RATE_LIMIT_MESSAGE,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const validation = validateSignUpInput(body);

    if (!validation.ok) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: SIGN_UP_VALIDATION_MESSAGE,
        fieldErrors: validation.fieldErrors,
      });
    }

    try {
      const result = await this.signUp.execute(validation.value);

      response.status(result.created ? HttpStatus.CREATED : HttpStatus.OK);

      return result.created
        ? { message: SIGN_UP_SUCCESS_MESSAGE, user: result.user }
        : { message: SIGN_UP_SUCCESS_MESSAGE };
    } catch (error) {
      if (error instanceof EmailAlreadyConfirmedError) {
        throw new HttpException(
          {
            code: "EMAIL_ALREADY_CONFIRMED",
            message: SIGN_UP_CONFLICT_MESSAGE,
          },
          HttpStatus.CONFLICT,
        );
      }

      if (error instanceof ConfirmationEmailDeliveryError) {
        throw new HttpException(
          {
            code: "CONFIRMATION_EMAIL_FAILED",
            message: SIGN_UP_EMAIL_FAILURE_MESSAGE,
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      throw error;
    }
  }

  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
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

  @Get("me")
  @UseGuards(SessionGuard)
  me(@CurrentUser() user: AuthUser): MeResponse {
    return { user };
  }
}
