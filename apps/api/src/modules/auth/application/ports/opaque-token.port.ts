export type GeneratedOpaqueToken = {
  /** Clear token sent to the person; never persisted or logged. */
  token: string;
  /** Hash persisted in `auth_tokens.token_hash`. */
  hash: string;
};

/**
 * Generates high-entropy opaque tokens and their at-rest hash. Keeping both
 * operations behind one port ensures no caller persists the clear value.
 */
export abstract class OpaqueTokenPort {
  abstract generate(): GeneratedOpaqueToken;

  abstract hash(token: string): string;
}
