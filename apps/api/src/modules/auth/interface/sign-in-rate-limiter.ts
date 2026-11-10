import { Inject, Injectable } from "@nestjs/common";

import {
  SIGN_IN_RATE_LIMIT_MAX,
  SIGN_IN_RATE_LIMIT_WINDOW_SECONDS,
} from "../auth.tokens";

import { SlidingWindowRateLimiter } from "./sliding-window-rate-limiter";

/**
 * Throttle for sign-in attempts against brute force. The controller keys it by
 * IP + normalized email, so repeated guesses against one account from one
 * address are slowed down. It only throttles: there is no permanent lockout.
 */
@Injectable()
export class SignInRateLimiter extends SlidingWindowRateLimiter {
  constructor(
    @Inject(SIGN_IN_RATE_LIMIT_MAX) max: number,
    @Inject(SIGN_IN_RATE_LIMIT_WINDOW_SECONDS) windowSeconds: number,
  ) {
    super(max, windowSeconds);
  }
}
