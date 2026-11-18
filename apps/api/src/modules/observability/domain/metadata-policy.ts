/**
 * Keys that must never reach the trace sink. The list is applied recursively
 * so nested `parameters` objects cannot reintroduce content or credentials.
 */
export const FORBIDDEN_METADATA_KEYS = [
  "prompt",
  "response",
  "answer",
  "content",
  "text",
  "excerpt",
  "snippet",
  "email",
  "emailaddress",
  "phone",
  "phonenumber",
  "password",
  "token",
  "apikey",
  "api_key",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "sessiontoken",
  "session_token",
  "authorization",
  "url",
  "uri",
  "address",
  "hash",
  "raw",
] as const;

const FORBIDDEN = new Set<string>(
  FORBIDDEN_METADATA_KEYS.map((key) => key.toLowerCase().replace(/_/g, "")),
);

function isForbidden(key: string): boolean {
  return FORBIDDEN.has(key.toLowerCase().replace(/_/g, ""));
}

function cleanValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cleanValue);

  if (typeof value === "object" && value !== null) {
    return stripForbiddenMetadata(value as Record<string, unknown>);
  }

  return value;
}

/** Returns a copy with forbidden keys removed at every nesting level. */
export function stripForbiddenMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (isForbidden(key)) continue;

    result[key] = cleanValue(value);
  }

  return result;
}
