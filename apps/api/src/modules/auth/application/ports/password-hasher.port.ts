/**
 * Password hashing port. `hash` is used by sign-up and `verify` by the sign-in
 * slice, so the algorithm stays behind a single boundary.
 */
export abstract class PasswordHasherPort {
  abstract hash(password: string): Promise<string>;

  abstract verify(password: string, passwordHash: string): Promise<boolean>;
}
