/** Origin that triggered a session creation, mirroring the `sessions.origin` check. */
export type SessionOrigin = "sign_up_confirmation" | "sign_in";

export const SESSION_ORIGINS: readonly SessionOrigin[] = [
  "sign_up_confirmation",
  "sign_in",
];

export type Session = {
  id: string;
  userId: string;
  origin: SessionOrigin;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
};
