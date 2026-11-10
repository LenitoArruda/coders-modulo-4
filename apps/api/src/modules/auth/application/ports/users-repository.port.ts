import type { AuthUser } from "../../domain/auth-user";

/** Account data plus the confirmation state used by sign-up rules. */
export type UserAccount = AuthUser & {
  emailConfirmedAt: Date | null;
  /** Stored hash; never returned by controllers or emails. */
  passwordHash: string;
};

export type CreateUserRecord = {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
};

export abstract class UsersRepositoryPort {
  abstract findById(id: string): Promise<AuthUser | null>;

  /** Case-insensitive lookup by the already normalized email. */
  abstract findByEmail(email: string): Promise<UserAccount | null>;

  /** Account data (including confirmation state) by id. */
  abstract findAccountById(id: string): Promise<UserAccount | null>;

  /**
   * Sets `email_confirmed_at` only when it is still null, so a second
   * confirmation never overwrites the original timestamp. Returns `false`
   * when the account was already confirmed (or does not exist).
   */
  abstract confirmEmail(id: string): Promise<boolean>;

  /**
   * Persists a new account. `email_confirmed_at` stays null: confirmation is
   * handled by the next slice.
   */
  abstract create(record: CreateUserRecord): Promise<UserAccount>;
}
