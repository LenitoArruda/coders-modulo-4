import { Injectable } from "@nestjs/common";
import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

import { PasswordHasherPort } from "../application/ports/password-hasher.port";

/**
 * scrypt parameters: N=2^15, r=8, p=1, 16-byte salt and 32-byte key.
 * scrypt is a memory-hard KDF available in the Node/Bun runtime, so no native
 * dependency is needed. Hashes are stored in a PHC-like self-describing format.
 */
const LOG_N = 15;
const COST = 2 ** LOG_N;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const KEY_LENGTH = 32;
const SALT_BYTES = 16;
const MAX_MEMORY_BYTES = 64 * 1024 * 1024;

const HASH_PREFIX = `$scrypt$ln=${LOG_N},r=${BLOCK_SIZE},p=${PARALLELIZATION}$`;

type ParsedHash = {
  cost: number;
  blockSize: number;
  parallelization: number;
  salt: Buffer;
  key: Buffer;
};

function deriveKey(
  password: string,
  salt: Buffer,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, options, (error, derivedKey) => {
      if (error) {
        reject(error);

        return;
      }

      resolve(derivedKey);
    });
  });
}

function parseHash(passwordHash: string): ParsedHash | null {
  const [empty, algorithm, params, saltValue, keyValue] =
    passwordHash.split("$");

  if (
    empty !== "" ||
    algorithm !== "scrypt" ||
    params === undefined ||
    saltValue === undefined ||
    keyValue === undefined
  ) {
    return null;
  }

  const match = /^ln=(\d{1,2}),r=(\d{1,2}),p=(\d)$/.exec(params);

  if (match === null) {
    return null;
  }

  const [, logNValue, blockSizeValue, parallelizationValue] = match;
  const logN = Number(logNValue);
  const blockSize = Number(blockSizeValue);
  const parallelization = Number(parallelizationValue);

  // Bounds protect verify against absurd parameters stored by mistake.
  if (
    !Number.isInteger(logN) ||
    logN < 10 ||
    logN > 20 ||
    !Number.isInteger(blockSize) ||
    blockSize < 1 ||
    blockSize > 32 ||
    !Number.isInteger(parallelization) ||
    parallelization < 1 ||
    parallelization > 4
  ) {
    return null;
  }

  const salt = Buffer.from(saltValue, "base64url");
  const key = Buffer.from(keyValue, "base64url");

  if (salt.length < 8 || key.length < 16 || key.length > 64) {
    return null;
  }

  return {
    cost: 2 ** logN,
    blockSize,
    parallelization,
    salt,
    key,
  };
}

@Injectable()
export class ScryptPasswordHasherAdapter extends PasswordHasherPort {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES);
    const key = await deriveKey(password, salt, {
      N: COST,
      r: BLOCK_SIZE,
      p: PARALLELIZATION,
      maxmem: MAX_MEMORY_BYTES,
    });

    return `${HASH_PREFIX}${salt.toString("base64url")}$${key.toString("base64url")}`;
  }

  async verify(password: string, passwordHash: string): Promise<boolean> {
    const parsed = parseHash(passwordHash);

    if (parsed === null) {
      return false;
    }

    const candidate = await deriveKey(password, parsed.salt, {
      N: parsed.cost,
      r: parsed.blockSize,
      p: parsed.parallelization,
      maxmem: MAX_MEMORY_BYTES,
    });

    return (
      candidate.length === parsed.key.length &&
      timingSafeEqual(candidate, parsed.key)
    );
  }
}
