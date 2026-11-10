import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { log } from "../../shared/observability/app-logger";
import { SESSION_TTL_SECONDS } from "../auth.tokens";
import type { AuthUser } from "../domain/auth-user";
import {
  EmailNotConfirmedError,
  InvalidCredentialsError,
} from "../domain/sign-in.errors";
import type { SignInInput } from "../domain/sign-in-input";

import { CreateSessionUseCase } from "./create-session.use-case";
import { PasswordHasherPort } from "./ports/password-hasher.port";
import { UsersRepositoryPort } from "./ports/users-repository.port";

export type SignInResult = {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: AuthUser;
};

/**
 * Authenticates by email and password and issues a `sign_in` session.
 *
 * Order matters for privacy: the password is verified first (against a real
 * hash of a throwaway secret when the account does not exist, so response time
 * does not tell the two cases apart) and the confirmation state is only
 * checked afterwards. A `403` therefore proves the caller knows the password.
 *
 * The session itself is created by `CreateSessionUseCase`, which keeps the
 * single-session policy, JWT signing and the new-session email in one place.
 */
@Injectable()
export class SignInUseCase {
  private dummyHash: Promise<string> | null = null;

  constructor(
    @Inject(UsersRepositoryPort)
    private readonly users: UsersRepositoryPort,
    @Inject(PasswordHasherPort)
    private readonly hasher: PasswordHasherPort,
    @Inject(CreateSessionUseCase)
    private readonly createSession: CreateSessionUseCase,
    @Inject(SESSION_TTL_SECONDS)
    private readonly sessionTtlSeconds: number,
  ) {}

  async execute(input: SignInInput): Promise<SignInResult> {
    const account = await this.users.findByEmail(input.email);
    const passwordHash = account?.passwordHash ?? (await this.getDummyHash());
    const passwordMatches = await this.hasher.verify(
      input.password,
      passwordHash,
    );

    if (account === null || !passwordMatches) {
      log("info", "Sign-in rejected", { outcome: "invalid_credentials" });

      throw new InvalidCredentialsError();
    }

    if (account.emailConfirmedAt === null) {
      log("info", "Sign-in rejected", {
        userId: account.id,
        outcome: "email_not_confirmed",
      });

      throw new EmailNotConfirmedError();
    }

    const user: AuthUser = {
      id: account.id,
      firstName: account.firstName,
      lastName: account.lastName,
      email: account.email,
    };
    const { token: accessToken } = await this.createSession.execute({
      user,
      origin: "sign_in",
    });

    log("info", "Sign-in succeeded", { userId: user.id, outcome: "signed_in" });

    return {
      accessToken,
      tokenType: "Bearer",
      expiresIn: this.sessionTtlSeconds,
      user,
    };
  }

  /** Hash of a random secret, computed once so unknown emails cost one verify. */
  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.hasher.hash(randomUUID());

    return this.dummyHash;
  }
}
