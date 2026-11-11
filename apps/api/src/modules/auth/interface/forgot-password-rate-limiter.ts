import { Inject, Injectable } from "@nestjs/common";

import {
  FORGOT_PASSWORD_RATE_LIMIT_MAX,
  FORGOT_PASSWORD_RATE_LIMIT_WINDOW_SECONDS,
} from "../auth.tokens";

import { SlidingWindowRateLimiter } from "./sliding-window-rate-limiter";

/**
 * Basic in-memory sliding-window limiter for the forgot-password endpoint. It
 * is separate from the sign-up limiter so each flow can have its own budget,
 * and it is process-local by design (a shared store is a documented
 * follow-up). Keys are namespaced by the caller (`ip:` and `email:`).
 */
@Injectable()
export class ForgotPasswordRateLimiter extends SlidingWindowRateLimiter {
  constructor(
    @Inject(FORGOT_PASSWORD_RATE_LIMIT_MAX) max: number,
    @Inject(FORGOT_PASSWORD_RATE_LIMIT_WINDOW_SECONDS)
    windowSeconds: number,
  ) {
    super(max, windowSeconds);
  }
}
