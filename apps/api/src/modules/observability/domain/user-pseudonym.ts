import { createHmac } from "node:crypto";

/**
 * Stable, one-way user identifier for trace metadata. The HMAC key is a
 * server-side salt, so the original id (which may be an e-mail) never leaves
 * the API.
 */
export function pseudonymizeUserId(userId: string, salt: string): string {
  const digest = createHmac("sha256", salt).update(userId).digest("hex");

  return `u_${digest.slice(0, 32)}`;
}
