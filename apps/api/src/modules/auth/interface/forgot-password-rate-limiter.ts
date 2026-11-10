import { Inject, Injectable } from "@nestjs/common";

import {
  FORGOT_PASSWORD_RATE_LIMIT_MAX,
  FORGOT_PASSWORD_RATE_LIMIT_WINDOW_SECONDS,
} from "../auth.tokens";

import type { RateLimitDecision } from "./sign-up-rate-limiter";

const MAX_TRACKED_KEYS = 10_000;

/**
 * Basic in-memory sliding-window limiter for the forgot-password endpoint. It
 * is separate from the sign-up limiter so each flow can have its own budget,
 * and it is process-local by design (a shared store is a documented
 * follow-up). Keys are namespaced by the caller (`ip:` and `email:`).
 */
@Injectable()
export class ForgotPasswordRateLimiter {
  private readonly attempts = new Map<string, number[]>();

  constructor(
    @Inject(FORGOT_PASSWORD_RATE_LIMIT_MAX) private readonly max: number,
    @Inject(FORGOT_PASSWORD_RATE_LIMIT_WINDOW_SECONDS)
    private readonly windowSeconds: number,
  ) {}

  consume(key: string): RateLimitDecision {
    const now = Date.now();
    const windowMs = this.windowSeconds * 1000;
    const recent = (this.attempts.get(key) ?? []).filter(
      (timestamp) => now - timestamp < windowMs,
    );

    if (recent.length >= this.max) {
      const oldest = recent[0] ?? now;
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((windowMs - (now - oldest)) / 1000),
      );

      this.attempts.set(key, recent);

      return { allowed: false, retryAfterSeconds };
    }

    recent.push(now);
    this.attempts.set(key, recent);
    this.prune(now, windowMs);

    return { allowed: true, retryAfterSeconds: 0 };
  }

  /** Test helper: forget every recorded attempt. */
  reset(): void {
    this.attempts.clear();
  }

  private prune(now: number, windowMs: number): void {
    if (this.attempts.size <= MAX_TRACKED_KEYS) {
      return;
    }

    for (const [key, timestamps] of this.attempts) {
      const last = timestamps.at(-1);

      if (last === undefined || now - last >= windowMs) {
        this.attempts.delete(key);
      }
    }
  }
}
