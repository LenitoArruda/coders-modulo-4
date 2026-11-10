/** Purposes allowed by the `auth_tokens.purpose` database constraint. */
export type AuthTokenPurpose = "email_confirmation" | "password_reset";

export type AuthTokenCreation = {
  userId: string;
  purpose: AuthTokenPurpose;
  tokenHash: string;
  expiresAt: Date;
};

export abstract class AuthTokensRepositoryPort {
  /** Persists a token row; only the hash is ever stored. */
  abstract create(creation: AuthTokenCreation): Promise<void>;

  /**
   * Marks every unused token of the user/purpose as used, so issuing a new
   * confirmation token invalidates the previous one.
   */
  abstract invalidateUnused(
    userId: string,
    purpose: AuthTokenPurpose,
  ): Promise<void>;

  /**
   * Marks every unused token of the user/purpose as used, except the token
   * whose hash is `keepTokenHash`. Issuing a token before revoking the others
   * (create-then-revoke) is the order that keeps a single valid token under
   * concurrent requests.
   */
  abstract invalidateUnusedExcept(
    userId: string,
    purpose: AuthTokenPurpose,
    keepTokenHash: string,
  ): Promise<void>;
}
