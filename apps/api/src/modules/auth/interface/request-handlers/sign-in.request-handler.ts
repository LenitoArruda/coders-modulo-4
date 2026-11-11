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
  type SignInResult,
  SignInUseCase,
} from "../../application/sign-in.use-case";
import {
  EmailNotConfirmedError,
  InvalidCredentialsError,
} from "../../domain/sign-in.errors";
import { parseSignInInput } from "../../domain/sign-in-input";

import { clientIp } from "../client-ip";
import { SignInRateLimiter } from "../sign-in-rate-limiter";

export type SignInResponse = SignInResult;

/** One message for unknown email and wrong password (malformed bodies get `400`). */
export const SIGN_IN_INVALID_CREDENTIALS_MESSAGE = "Invalid email or password.";

export const SIGN_IN_EMAIL_NOT_CONFIRMED_MESSAGE =
  "Please confirm your email before signing in.";

const SIGN_IN_VALIDATION_MESSAGE = "Enter your email address and password.";

const SIGN_IN_RATE_LIMIT_MESSAGE =
  "Too many attempts. Wait a moment and try again.";

@Controller("auth")
export class SignInRequestHandler {
  constructor(
    @Inject(SignInUseCase) private readonly signInUseCase: SignInUseCase,
    @Inject(SignInRateLimiter)
    private readonly signInLimiter: SignInRateLimiter,
  ) {}

  @Post("sign-in")
  @HttpCode(HttpStatus.OK)
  async handle(
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
}
