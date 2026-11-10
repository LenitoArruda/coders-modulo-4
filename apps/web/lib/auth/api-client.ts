import { cookies } from "next/headers";

import { SESSION_COOKIE_NAME } from "./session-cookie";

/** Default API base URL for the local development stack. */
export const DEFAULT_API_BASE_URL = "http://localhost:3333";

export function getApiBaseUrl(): string {
  return process.env.API_BASE_URL || DEFAULT_API_BASE_URL;
}

/**
 * Reads the session JWT from the HttpOnly cookie on the server. The token is
 * never exposed to the browser bundle or to client-side JavaScript.
 */
export async function getBearerToken(): Promise<string | null> {
  const store = await cookies();

  return store.get(SESSION_COOKIE_NAME)?.value ?? null;
}

/**
 * Calls the API from the web server, forwarding the session as
 * `Authorization: Bearer`. When there is no cookie the request is anonymous
 * (no header), and the API decides whether the route requires a session.
 */
export async function fetchApiWithSession(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getBearerToken();
  const headers = new Headers(init.headers);

  if (token !== null) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(new URL(path, getApiBaseUrl()), { ...init, headers });
}
