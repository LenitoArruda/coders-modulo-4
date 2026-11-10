import { Inject, Injectable } from "@nestjs/common";

import { log } from "../../shared/observability/app-logger";
import { WEB_ORIGIN } from "../auth.tokens";
import { InvalidResetTokenError } from "../domain/reset-password.errors";
import type { ResetPasswordInput } from "../domain/reset-password-input";

import { buildPasswordChangedEmail } from "./password-changed-email";
import { AuthTokensRepositoryPort } from "./ports/auth-tokens-repository.port";
import { EmailSenderPort } from "./ports/email-sender.port";
import { OpaqueTokenPort } from "./ports/opaque-token.port";
import { PasswordHasherPort } from "./ports/password-hasher.port";
import { SessionsRepositoryPort } from "./ports/sessions-repository.port";
import { UsersRepositoryPort } from "./ports/users-repository.port";

/**
 * Completes a password reset from a single-use opaque token.
 *
 * There is no database transaction: consistency comes from the order of the
 * writes. The caller has already validated the password, and the new hash is
 * computed before the token is touched, so neither a weak password nor a
 * hashing failure burns the token. Then, in this order: consume the token
 * (conditional on `used_at is null`, which lets only one concurrent request
 * win), update the hash, confirm the email, invalidate the other reset tokens
 * and revoke every active session. If a step fails after the token was
 * consumed, the person must request a new link; no old session is valid once
 * this use case resolves. Strict atomicity remains a follow-up (ADR 0013).
 */
@Injectable()
export class ResetPasswordUseCase {
  constructor(
    @Inject(UsersRepositoryPort)
    private readonly users: UsersRepositoryPort,
    @Inject(AuthTokensRepositoryPort)
    private readonly authTokens: AuthTokensRepositoryPort,
    @Inject(SessionsRepositoryPort)
    private readonly sessions: SessionsRepositoryPort,
    @Inject(OpaqueTokenPort)
    private readonly opaqueTokens: OpaqueTokenPort,
    @Inject(PasswordHasherPort)
    private readonly hasher: PasswordHasherPort,
    @Inject(EmailSenderPort)
    private readonly emails: EmailSenderPort,
    @Inject(WEB_ORIGIN)
    private readonly webOrigin: string,
  ) {}

  async execute(input: ResetPasswordInput): Promise<void> {
    if (input.token.length === 0) {
      throw new InvalidResetTokenError();
    }

    const record = await this.authTokens.findByHash(
      this.opaqueTokens.hash(input.token),
    );

    if (
      record === null ||
      record.purpose !== "password_reset" ||
      record.usedAt !== null ||
      record.expiresAt.getTime() <= Date.now()
    ) {
      throw new InvalidResetTokenError();
    }

    const account = await this.users.findAccountById(record.userId);

    if (account === null) {
      throw new InvalidResetTokenError();
    }

    const passwordHash = await this.hasher.hash(input.password);

    if (!(await this.authTokens.consume(record.id))) {
      // A concurrent request consumed the same token first.
      throw new InvalidResetTokenError();
    }

    await this.users.updatePassword(account.id, passwordHash);
    // The token proves control of the mailbox. `false` only means the email
    // was already confirmed, which is fine.
    await this.users.confirmEmail(account.id);
    await this.authTokens.invalidateUnused(account.id, "password_reset");
    await this.sessions.revokeAllActive(account.id);

    log("info", "Senha redefinida", {
      userId: account.id,
      outcome: "password_reset",
    });

    await this.notifyPasswordChanged(account);
  }

  private async notifyPasswordChanged(account: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  }): Promise<void> {
    const forgotPasswordUrl = new URL("/auth/forgot-password", this.webOrigin);

    try {
      await this.emails.send(
        buildPasswordChangedEmail({
          user: {
            id: account.id,
            firstName: account.firstName,
            lastName: account.lastName,
            email: account.email,
          },
          forgotPasswordUrl: forgotPasswordUrl.toString(),
        }),
      );
    } catch (error) {
      // The password stays changed: only the notification is lost.
      log("warn", "E-mail de senha alterada não foi enviado", {
        userId: account.id,
        outcome: "password_changed_email_failed",
        error: error instanceof Error ? error.name : "unknown",
      });
    }
  }
}
