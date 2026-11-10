import { afterEach, describe, expect, it, vi } from "vitest";

import { SignInRateLimiter } from "./sign-in-rate-limiter";

describe("SignInRateLimiter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("deve permitir até o limite e bloquear a tentativa seguinte", () => {
    const limiter = new SignInRateLimiter(2, 60);

    expect(limiter.consume("ip:127.0.0.1")).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
    expect(limiter.consume("ip:127.0.0.1").allowed).toBe(true);

    const blocked = limiter.consume("ip:127.0.0.1");

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("deve liberar novas tentativas quando a janela expira (sem lockout)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-10T12:00:00.000Z"));

    const limiter = new SignInRateLimiter(1, 60);

    expect(limiter.consume("email:ada@example.com").allowed).toBe(true);
    expect(limiter.consume("email:ada@example.com").allowed).toBe(false);

    vi.advanceTimersByTime(60_001);

    expect(limiter.consume("email:ada@example.com").allowed).toBe(true);
  });

  it("deve isolar o limite por chave", () => {
    const limiter = new SignInRateLimiter(1, 60);

    expect(limiter.consume("ip:a").allowed).toBe(true);
    expect(limiter.consume("ip:a").allowed).toBe(false);
    expect(limiter.consume("email:a").allowed).toBe(true);
  });
});
