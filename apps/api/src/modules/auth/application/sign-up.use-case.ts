import { Inject, Injectable } from "@nestjs/common";

import { log } from "../../shared/observability/app-logger";
import { CONFIRMATION_TOKEN_TTL_SECONDS, WEB_ORIGIN } from "../auth.tokens";
import type { AuthUser } from "../domain/auth-user";
import { type SignUpInput, normalizeEmail } from "../domain/sign-up-input";
import {
  ConfirmationEmailDeliveryError,
  DuplicateEmailError,
  EmailAlreadyConfirmedError,
} from "../domain/sign-up.errors";

import { buildConfirmationEmail } from "./confirmation-email";
import { AuthTokensRepositoryPort } from "./ports/auth-tokens-repository.port";
import { EmailSenderPort } from "./ports/email-sender.port";
import { OpaqueTokenPort } from "./ports/opaque-token.port";
import { PasswordHasherPort } from "./ports/password-hasher.port";
import {
  type UserAccount,
  UsersRepositoryPort,
} from "./ports/users-repository.port";

export type SignUpResult = {
  /** `true` when the account was created by this call. */
  created: boolean;
  user: AuthUser;
};

function toAuthUser(account: UserAccount): AuthUser {
  return {
    id: account.id,
    firstName: account.firstName,
    lastName: account.lastName,
    email: account.email,
  };
}

/**
 * Creates an unconfirmed account and sends a single-use confirmation token, or
 * reissues the confirmation for an existing unconfirmed email. It never opens
 * a session: sign-up only prepares the account for the confirmation slice.
 */
@Injectable()
export class SignUpUseCase {
  constructor(
    @Inject(UsersRepositoryPort)
    private readonly users: UsersRepositoryPort,
    @Inject(AuthTokensRepositoryPort)
    private readonly authTokens: AuthTokensRepositoryPort,
    @Inject(PasswordHasherPort)
    private readonly passwordHasher: PasswordHasherPort,
    @Inject(OpaqueTokenPort)
    private readonly opaqueTokens: OpaqueTokenPort,
    @Inject(EmailSenderPort)
    private readonly emails: EmailSenderPort,
    @Inject(CONFIRMATION_TOKEN_TTL_SECONDS)
    private readonly tokenTtlSeconds: number,
    @Inject(WEB_ORIGIN)
    private readonly webOrigin: string,
  ) {}

  async execute(input: SignUpInput): Promise<SignUpResult> {
    const email = normalizeEmail(input.email);
    const existing = await this.users.findByEmail(email);

    if (existing !== null) {
      return this.resendConfirmation(existing);
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    let account: UserAccount;

    try {
      account = await this.users.create({
        firstName: input.firstName,
        lastName: input.lastName,
        email,
        passwordHash,
      });
    } catch (error) {
      if (error instanceof DuplicateEmailError) {
        // A concurrent request created the account between the lookup and the
        // insert. Reuse it instead of surfacing a database detail.
        const raced = await this.users.findByEmail(email);

        if (raced !== null) {
          return this.resendConfirmation(raced);
        }
      }

      throw error;
    }

    await this.issueConfirmationToken(account);
    log("info", "Sign-up criado", {
      userId: account.id,
      outcome: "created",
    });

    return { created: true, user: toAuthUser(account) };
  }

  private async resendConfirmation(
    account: UserAccount,
  ): Promise<SignUpResult> {
    if (account.emailConfirmedAt !== null) {
      throw new EmailAlreadyConfirmedError();
    }

    await this.issueConfirmationToken(account);
    log("info", "Confirmação reenviada", {
      userId: account.id,
      outcome: "confirmation_resent",
    });

    return { created: false, user: toAuthUser(account) };
  }

  private async issueConfirmationToken(account: UserAccount): Promise<void> {
    const generated = this.opaqueTokens.generate();
    const expiresAt = new Date(Date.now() + this.tokenTtlSeconds * 1000);

    // A new token always invalidates the previous unused one for this purpose.
    await this.authTokens.invalidateUnused(account.id, "email_confirmation");
    await this.authTokens.create({
      userId: account.id,
      purpose: "email_confirmation",
      tokenHash: generated.hash,
      expiresAt,
    });

    const confirmationUrl = new URL("/auth/confirm", this.webOrigin);
    confirmationUrl.searchParams.set("token", generated.token);

    try {
      await this.emails.send(
        buildConfirmationEmail({
          user: toAuthUser(account),
          confirmationUrl: confirmationUrl.toString(),
          expiresAt,
          ttlSeconds: this.tokenTtlSeconds,
        }),
      );
    } catch (error) {
      log("warn", "E-mail de confirmação não foi enviado", {
        userId: account.id,
        outcome: "confirmation_email_failed",
        error: error instanceof Error ? error.name : "unknown",
      });

      throw new ConfirmationEmailDeliveryError(error);
    }
  }
}
