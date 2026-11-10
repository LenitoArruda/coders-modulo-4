import { Inject, Injectable } from "@nestjs/common";

import {
  RESET_PASSWORD_RATE_LIMIT_MAX,
  RESET_PASSWORD_RATE_LIMIT_WINDOW_SECONDS,
} from "../auth.tokens";

import { SlidingWindowRateLimiter } from "./sliding-window-rate-limiter";

/**
 * Throttle for `POST /api/v1/auth/reset-password`, keyed by client IP by the
 * controller. It has its own budget, separate from the other auth endpoints,
 * and is process-local by design (a shared store is a documented follow-up).
 */
@Injectable()
export class ResetPasswordRateLimiter extends SlidingWindowRateLimiter {
  constructor(
    @Inject(RESET_PASSWORD_RATE_LIMIT_MAX) max: number,
    @Inject(RESET_PASSWORD_RATE_LIMIT_WINDOW_SECONDS) windowSeconds: number,
  ) {
    super(max, windowSeconds);
  }
}
