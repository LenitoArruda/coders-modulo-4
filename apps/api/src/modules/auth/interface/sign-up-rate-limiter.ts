import { Inject, Injectable } from "@nestjs/common";

import {
  SIGN_UP_RATE_LIMIT_MAX,
  SIGN_UP_RATE_LIMIT_WINDOW_SECONDS,
} from "../auth.tokens";

import { SlidingWindowRateLimiter } from "./sliding-window-rate-limiter";

/** Basic per-IP limiter for the sign-up endpoint. */
@Injectable()
export class SignUpRateLimiter extends SlidingWindowRateLimiter {
  constructor(
    @Inject(SIGN_UP_RATE_LIMIT_MAX) max: number,
    @Inject(SIGN_UP_RATE_LIMIT_WINDOW_SECONDS)
    windowSeconds: number,
  ) {
    super(max, windowSeconds);
  }
}
