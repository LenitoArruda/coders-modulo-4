import { Inject, Injectable } from "@nestjs/common";

import {
  CONFIRMATION_RATE_LIMIT_MAX,
  CONFIRMATION_RATE_LIMIT_WINDOW_SECONDS,
} from "../auth.tokens";

import { SlidingWindowRateLimiter } from "./sliding-window-rate-limiter";

/**
 * Basic per-IP limiter for the confirmation endpoint. The token itself is the
 * credential, so the limit protects against guessing and replay bursts.
 */
@Injectable()
export class ConfirmationRateLimiter extends SlidingWindowRateLimiter {
  constructor(
    @Inject(CONFIRMATION_RATE_LIMIT_MAX) max: number,
    @Inject(CONFIRMATION_RATE_LIMIT_WINDOW_SECONDS)
    windowSeconds: number,
  ) {
    super(max, windowSeconds);
  }
}
