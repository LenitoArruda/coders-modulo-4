import { cache } from "react";

import { fetchApiWithSession, getBearerToken } from "./api-client";

/** API endpoint that returns the authenticated person's basic data. */
export const AUTH_ME_PATH = "/api/v1/auth/me";

/** Basic authenticated person returned by `GET /api/v1/auth/me`. */
export type SessionUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

function isSessionUser(value: unknown): value is SessionUser {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.firstName === "string" &&
    typeof candidate.lastName === "string" &&
    typeof candidate.email === "string"
  );
}

function isMeResponse(value: unknown): value is { user: SessionUser } {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return isSessionUser((value as Record<string, unknown>).user);
}

/**
 * Resolves the authenticated person on the server. The API is the source of
 * truth: a missing cookie, an invalid/expired/revoked session or an API
 * failure all mean "no session" (fail closed). The token never leaves the
 * server and is never rendered.
 *
 * `cache()` deduplicates the `/me` call between the private layout and the
 * page during the same render. Outside a React render it simply executes.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = await getBearerToken();

  if (token === null) {
    return null;
  }

  try {
    const response = await fetchApiWithSession(AUTH_ME_PATH, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const body: unknown = await response.json();

    return isMeResponse(body) ? body.user : null;
  } catch {
    return null;
  }
});
