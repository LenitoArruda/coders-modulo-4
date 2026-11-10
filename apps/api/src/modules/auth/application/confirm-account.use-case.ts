import { Inject, Injectable } from "@nestjs/common";

import { log } from "../../shared/observability/app-logger";
import { SESSION_TTL_SECONDS } from "../auth.tokens";
import type { AuthUser } from "../domain/auth-user";
import {
  AccountAlreadyConfirmedError,
  InvalidConfirmationTokenError,
} from "../domain/confirmation.errors";

import { CreateSessionUseCase } from "./create-session.use-case";
import { AuthTokensRepositoryPort } from "./ports/auth-tokens-repository.port";
import { OpaqueTokenPort } from "./ports/opaque-token.port";
import {
  type UserAccount,
  UsersRepositoryPort,
} from "./ports/users-repository.port";

export type ConfirmAccountResult = {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
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
 * Confirms an account from a single-use opaque token and issues its first
 * session. The token is looked up by hash, consumed atomically before the
 * account is confirmed, and a second confirmation of the same account is a
 * conflict (`409`) instead of a new session.
 *
 * The session is created through `CreateSessionUseCase`, so the single-session
 * policy, JWT signing and the new-session notification stay in one place.
 */
@Injectable()
export class ConfirmAccountUseCase {
  constructor(
    @Inject(UsersRepositoryPort)
    private readonly users: UsersRepositoryPort,
    @Inject(AuthTokensRepositoryPort)
    private readonly authTokens: AuthTokensRepositoryPort,
    @Inject(OpaqueTokenPort)
    private readonly opaqueTokens: OpaqueTokenPort,
    @Inject(CreateSessionUseCase)
    private readonly createSession: CreateSessionUseCase,
    @Inject(SESSION_TTL_SECONDS)
    private readonly sessionTtlSeconds: number,
  ) {}

  async execute(token: string): Promise<ConfirmAccountResult> {
    const clearToken = token.trim();

    if (clearToken.length === 0) {
      throw new InvalidConfirmationTokenError();
    }

    const tokenHash = this.opaqueTokens.hash(clearToken);
    const record = await this.authTokens.findByHash(tokenHash);

    if (record === null || record.purpose !== "email_confirmation") {
      throw new InvalidConfirmationTokenError();
    }

    const account = await this.users.findAccountById(record.userId);

    if (account === null) {
      throw new InvalidConfirmationTokenError();
    }

    // A confirmed account always wins over the token state: the person should
    // sign in instead of receiving a misleading "expired link" message.
    if (account.emailConfirmedAt !== null) {
      throw new AccountAlreadyConfirmedError();
    }

    if (record.usedAt !== null) {
      throw new InvalidConfirmationTokenError();
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      throw new InvalidConfirmationTokenError();
    }

    if (!(await this.authTokens.consume(record.id))) {
      const raced = await this.users.findAccountById(record.userId);

      if (raced !== null && raced.emailConfirmedAt !== null) {
        throw new AccountAlreadyConfirmedError();
      }

      throw new InvalidConfirmationTokenError();
    }

    if (!(await this.users.confirmEmail(account.id))) {
      // Another request confirmed the account between the checks above.
      throw new AccountAlreadyConfirmedError();
    }

    const user = toAuthUser(account);
    const { token: accessToken } = await this.createSession.execute({
      user,
      origin: "sign_up_confirmation",
    });

    log("info", "Conta confirmada", {
      userId: user.id,
      outcome: "email_confirmed",
    });

    return {
      accessToken,
      tokenType: "Bearer",
      expiresIn: this.sessionTtlSeconds,
      user,
    };
  }
}
