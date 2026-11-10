import { Inject, Injectable } from "@nestjs/common";

import { log } from "../../shared/observability/app-logger";
import { RESET_TOKEN_TTL_SECONDS, WEB_ORIGIN } from "../auth.tokens";
import type { ForgotPasswordInput } from "../domain/forgot-password-input";
import { normalizeEmail } from "../domain/sign-up-input";

import { AuthTokensRepositoryPort } from "./ports/auth-tokens-repository.port";
import { EmailSenderPort } from "./ports/email-sender.port";
import { OpaqueTokenPort } from "./ports/opaque-token.port";
import {
  type UserAccount,
  UsersRepositoryPort,
} from "./ports/users-repository.port";
import { buildResetPasswordEmail } from "./reset-password-email";

/**
 * Issues a single-use password reset token for an existing account and sends
 * the recovery email. It never reveals whether the account exists: a missing
 * email is only recorded internally, and email failures are swallowed so the
 * caller keeps the same generic response.
 */
@Injectable()
export class RequestPasswordResetUseCase {
  constructor(
    @Inject(UsersRepositoryPort)
    private readonly users: UsersRepositoryPort,
    @Inject(AuthTokensRepositoryPort)
    private readonly authTokens: AuthTokensRepositoryPort,
    @Inject(OpaqueTokenPort)
    private readonly opaqueTokens: OpaqueTokenPort,
    @Inject(EmailSenderPort)
    private readonly emails: EmailSenderPort,
    @Inject(RESET_TOKEN_TTL_SECONDS)
    private readonly tokenTtlSeconds: number,
    @Inject(WEB_ORIGIN)
    private readonly webOrigin: string,
  ) {}

  async execute(input: ForgotPasswordInput): Promise<void> {
    const account = await this.users.findByEmail(normalizeEmail(input.email));

    if (account === null) {
      // No PII here: the outcome alone is enough for operations.
      log("info", "Recuperação de senha solicitada", {
        outcome: "account_not_found",
      });

      return;
    }

    await this.issueResetToken(account);
  }

  private async issueResetToken(account: UserAccount): Promise<void> {
    const generated = this.opaqueTokens.generate();
    const expiresAt = new Date(Date.now() + this.tokenTtlSeconds * 1000);

    // Create-then-revoke keeps a single valid token under concurrent requests:
    // the last revocation removes everything except its own hash, so two
    // simultaneous requests can never leave two valid reset tokens.
    await this.authTokens.create({
      userId: account.id,
      purpose: "password_reset",
      tokenHash: generated.hash,
      expiresAt,
    });
    await this.authTokens.invalidateUnusedExcept(
      account.id,
      "password_reset",
      generated.hash,
    );

    const resetUrl = new URL("/auth/reset-password", this.webOrigin);
    resetUrl.searchParams.set("token", generated.token);

    try {
      await this.emails.send(
        buildResetPasswordEmail({
          user: {
            id: account.id,
            firstName: account.firstName,
            lastName: account.lastName,
            email: account.email,
          },
          resetUrl: resetUrl.toString(),
          expiresAt,
          ttlSeconds: this.tokenTtlSeconds,
        }),
      );
    } catch (error) {
      // A failed email must not break the anti-enumeration response. The
      // token stays valid so a new request can replace it.
      log("warn", "E-mail de recuperação não foi enviado", {
        userId: account.id,
        outcome: "reset_email_failed",
        error: error instanceof Error ? error.name : "unknown",
      });
    }
  }
}
