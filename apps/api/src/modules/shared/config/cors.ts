/** HTTP methods required by the web -> API auth flow. */
export const CORS_METHODS = ["GET", "HEAD", "POST", "OPTIONS"] as const;

/** Request headers the web may send to the API. */
export const CORS_ALLOWED_HEADERS = ["Authorization", "Content-Type"] as const;

/**
 * CORS allowlist by environment. Requests without an `Origin` header (server
 * to server, curl, health checks) are allowed; browser requests must match the
 * configured web origin exactly.
 */
export function isAllowedCorsOrigin(
  origin: string | undefined,
  webOrigin: string,
): boolean {
  return !origin || origin === webOrigin;
}
