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

import {
  type ConfirmAccountResult,
  ConfirmAccountUseCase,
} from "../application/confirm-account.use-case";
import { RequestPasswordResetUseCase } from "../application/request-password-reset.use-case";
import { ResetPasswordUseCase } from "../application/reset-password.use-case";
import {
  type SignInResult,
  SignInUseCase,
} from "../application/sign-in.use-case";
import { SignUpUseCase } from "../application/sign-up.use-case";
import type { AuthUser } from "../domain/auth-user";
import {
  AccountAlreadyConfirmedError,
  InvalidConfirmationTokenError,
} from "../domain/confirmation.errors";
import { validateForgotPasswordInput } from "../domain/forgot-password-input";
import { InvalidResetTokenError } from "../domain/reset-password.errors";
import { validateResetPasswordInput } from "../domain/reset-password-input";
import {
  EmailNotConfirmedError,
  InvalidCredentialsError,
} from "../domain/sign-in.errors";
import { parseSignInInput } from "../domain/sign-in-input";
import { validateSignUpInput } from "../domain/sign-up-input";
import {
  ConfirmationEmailDeliveryError,
  EmailAlreadyConfirmedError,
} from "../domain/sign-up.errors";

import { ConfirmationRateLimiter } from "./confirmation-rate-limiter";
import { CurrentUser } from "./current-user.decorator";
import { ForgotPasswordRateLimiter } from "./forgot-password-rate-limiter";
import { ResetPasswordRateLimiter } from "./reset-password-rate-limiter";
import { SessionGuard } from "./session.guard";
import { SignInRateLimiter } from "./sign-in-rate-limiter";
import { SignUpRateLimiter } from "./sign-up-rate-limiter";

export type MeResponse = { user: AuthUser };

export type SignUpResponse = {
  message: string;
  user?: AuthUser;
};

export type ConfirmAccountResponse = ConfirmAccountResult;

export const SIGN_UP_SUCCESS_MESSAGE =
  "Check your email to confirm your account.";

export const SIGN_UP_CONFLICT_MESSAGE =
  "An account with this email already exists. Sign in instead.";

export const CONFIRM_INVALID_MESSAGE =
  "This confirmation link is invalid or has expired.";

export const CONFIRM_ALREADY_CONFIRMED_MESSAGE =
  "This account is already confirmed. Sign in instead.";

const SIGN_UP_VALIDATION_MESSAGE =
  "Check the highlighted fields and try again.";
const SIGN_UP_RATE_LIMIT_MESSAGE =
  "Too many attempts. Wait a moment and try again.";
const SIGN_UP_EMAIL_FAILURE_MESSAGE =
  "We could not send the confirmation email. Try again in a moment.";
const CONFIRM_RATE_LIMIT_MESSAGE =
  "Too many attempts. Wait a moment and try again.";

export type SignInResponse = SignInResult;

/** One message for unknown email and wrong password (malformed bodies get `400`). */
export const SIGN_IN_INVALID_CREDENTIALS_MESSAGE = "Invalid email or password.";

export const SIGN_IN_EMAIL_NOT_CONFIRMED_MESSAGE =
  "Please confirm your email before signing in.";

const SIGN_IN_VALIDATION_MESSAGE = "Enter your email address and password.";

const SIGN_IN_RATE_LIMIT_MESSAGE =
  "Too many attempts. Wait a moment and try again.";

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

export type ResetPasswordResponse = { message: string };

export const RESET_PASSWORD_SUCCESS_MESSAGE =
  "Your password has been updated. Sign in with your new password.";

export const RESET_PASSWORD_INVALID_TOKEN_MESSAGE =
  "This password reset link is invalid or has expired.";

const RESET_PASSWORD_VALIDATION_MESSAGE =
  "Check the highlighted fields and try again.";
const RESET_PASSWORD_RATE_LIMIT_MESSAGE =
  "Too many attempts. Wait a moment and try again.";

function clientIp(request: Request): string {
  return request.ip ?? request.socket.remoteAddress ?? "unknown";
}

function readConfirmationToken(body: unknown): string | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const value = (body as Record<string, unknown>).token;

  if (typeof value !== "string") {
    return null;
  }

  const token = value.trim();

  return token.length > 0 ? token : null;
}

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(SignUpUseCase) private readonly signUp: SignUpUseCase,
    @Inject(SignUpRateLimiter)
    private readonly rateLimiter: SignUpRateLimiter,
    @Inject(ConfirmAccountUseCase)
    private readonly confirmAccountUseCase: ConfirmAccountUseCase,
    @Inject(ConfirmationRateLimiter)
    private readonly confirmationLimiter: ConfirmationRateLimiter,
    @Inject(RequestPasswordResetUseCase)
    private readonly requestPasswordReset: RequestPasswordResetUseCase,
    @Inject(ForgotPasswordRateLimiter)
    private readonly forgotPasswordRateLimiter: ForgotPasswordRateLimiter,
    @Inject(ResetPasswordUseCase)
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
    @Inject(ResetPasswordRateLimiter)
    private readonly resetPasswordLimiter: ResetPasswordRateLimiter,
    @Inject(SignInUseCase) private readonly signInUseCase: SignInUseCase,
    @Inject(SignInRateLimiter)
    private readonly signInLimiter: SignInRateLimiter,
  ) {}

  @Post("sign-in")
  @HttpCode(HttpStatus.OK)
  async signIn(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SignInResponse> {
    const input = parseSignInInput(body);

    if (input === null) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: SIGN_IN_VALIDATION_MESSAGE,
      });
    }

    // One bucket per IP + normalized email: guessing one account's password
    // from one address is throttled without letting a stranger lock the
    // account out for everyone else (no permanent lockout either).
    const decision = this.signInLimiter.consume(
      `${clientIp(request)}|${input.email}`,
    );

    if (!decision.allowed) {
      response.setHeader("Retry-After", String(decision.retryAfterSeconds));

      throw new HttpException(
        { code: "TOO_MANY_REQUESTS", message: SIGN_IN_RATE_LIMIT_MESSAGE },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    try {
      return await this.signInUseCase.execute(input);
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        throw this.invalidCredentials();
      }

      if (error instanceof EmailNotConfirmedError) {
        throw new HttpException(
          {
            code: "EMAIL_NOT_CONFIRMED",
            message: SIGN_IN_EMAIL_NOT_CONFIRMED_MESSAGE,
          },
          HttpStatus.FORBIDDEN,
        );
      }

      throw error;
    }
  }

  private invalidCredentials(): HttpException {
    return new HttpException(
      {
        code: "INVALID_CREDENTIALS",
        message: SIGN_IN_INVALID_CREDENTIALS_MESSAGE,
      },
      HttpStatus.UNAUTHORIZED,
    );
  }

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

  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  async resetPassword(
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

  @Get("me")
  @UseGuards(SessionGuard)
  me(@CurrentUser() user: AuthUser): MeResponse {
    return { user };
  }

  @Post("confirm")
  @HttpCode(HttpStatus.OK)
  async confirmAccount(
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
