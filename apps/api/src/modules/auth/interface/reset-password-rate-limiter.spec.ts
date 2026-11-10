import { afterEach, describe, expect, it, vi } from "vitest";

import { ResetPasswordRateLimiter } from "./reset-password-rate-limiter";

describe("ResetPasswordRateLimiter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("deve permitir até o limite e bloquear a tentativa seguinte", () => {
    const limiter = new ResetPasswordRateLimiter(5, 60);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(limiter.consume("203.0.113.9").allowed).toBe(true);
    }

    const blocked = limiter.consume("203.0.113.9");

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("deve liberar novas tentativas quando a janela expira", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-10T12:00:00.000Z"));

    const limiter = new ResetPasswordRateLimiter(1, 60);

    expect(limiter.consume("203.0.113.9").allowed).toBe(true);
    expect(limiter.consume("203.0.113.9").allowed).toBe(false);

    vi.advanceTimersByTime(60_001);

    expect(limiter.consume("203.0.113.9").allowed).toBe(true);
  });

  it("deve isolar o limite por IP", () => {
    const limiter = new ResetPasswordRateLimiter(1, 60);

    expect(limiter.consume("203.0.113.9").allowed).toBe(true);
    expect(limiter.consume("203.0.113.9").allowed).toBe(false);
    expect(limiter.consume("203.0.113.10").allowed).toBe(true);
  });
});
