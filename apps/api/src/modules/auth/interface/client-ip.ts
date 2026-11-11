import type { Request } from "express";

/** Best-effort client address used as the rate limit key for IP-only flows. */
export function clientIp(request: Request): string {
  return request.ip ?? request.socket.remoteAddress ?? "unknown";
}
