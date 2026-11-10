import { createHash } from "node:crypto";

import {
  OpaqueTokenPort,
  type GeneratedOpaqueToken,
} from "../../modules/auth/application/ports/opaque-token.port";

/** Deterministic token generator for assertions on clear/hash pairs. */
export class FakeOpaqueToken extends OpaqueTokenPort {
  private sequence = 0;

  generate(): GeneratedOpaqueToken {
    this.sequence += 1;
    const token = `clear-token-${this.sequence}`;

    return { token, hash: this.hash(token) };
  }

  hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
