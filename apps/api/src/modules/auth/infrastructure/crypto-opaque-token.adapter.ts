import { Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";

import {
  OpaqueTokenPort,
  type GeneratedOpaqueToken,
} from "../application/ports/opaque-token.port";

/** 32 random bytes give 256 bits of entropy, rendered as 43 base64url chars. */
const TOKEN_BYTES = 32;

@Injectable()
export class CryptoOpaqueTokenAdapter extends OpaqueTokenPort {
  generate(): GeneratedOpaqueToken {
    const token = randomBytes(TOKEN_BYTES).toString("base64url");

    return { token, hash: this.hash(token) };
  }

  hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
