import { PasswordHasherPort } from "../../modules/auth/application/ports/password-hasher.port";

/**
 * Deterministic fake: the stored value is clearly not the password and the
 * prefix lets tests assert that the service persisted the hash.
 */
export class FakePasswordHasher extends PasswordHasherPort {
  async hash(password: string): Promise<string> {
    return `fake-hash:${password}`;
  }

  async verify(password: string, passwordHash: string): Promise<boolean> {
    return passwordHash === `fake-hash:${password}`;
  }
}
