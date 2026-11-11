/**
 * Reads the confirmation token from an untrusted body. Anything other than a
 * non-empty string is treated as absent, so the caller can answer `400`.
 */
export function readConfirmationToken(body: unknown): string | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const value = (body as Record<string, unknown>).token;

  if (typeof value !== "string") {
    return null;
  }

  const token = value.trim();

  return token.length > 0 ? token : null;
}
