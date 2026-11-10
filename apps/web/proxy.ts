import { NextResponse, type NextRequest } from "next/server";

import { RETURN_TO_HEADER } from "./lib/auth/route-rules";

/**
 * Forwards the requested path of `/app/*` to server components through a
 * request header, because layouts do not know the current pathname. It always
 * overwrites any value sent by the client and never decides access: the
 * session guard in the private layout remains the single gate, and the value
 * is sanitized again before it is used in a redirect.
 */
export function proxy(request: NextRequest): NextResponse {
  const requestHeaders = new Headers(request.headers);
  const { pathname, search } = request.nextUrl;

  requestHeaders.set(RETURN_TO_HEADER, `${pathname}${search}`);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/app", "/app/:path*"],
};
