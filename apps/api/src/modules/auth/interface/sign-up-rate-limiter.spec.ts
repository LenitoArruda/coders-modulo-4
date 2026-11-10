import { afterEach, describe, expect, it, vi } from "vitest";

import { SignUpRateLimiter } from "./sign-up-rate-limiter";

describe("SignUpRateLimiter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("deve permitir até o limite e bloquear a tentativa seguinte", () => {
    const limiter = new SignUpRateLimiter(2, 60);

    expect(limiter.consume("127.0.0.1")).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
    expect(limiter.consume("127.0.0.1").allowed).toBe(true);

    const blocked = limiter.consume("127.0.0.1");

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("deve liberar novas tentativas quando a janela expira", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-09T12:00:00.000Z"));

    const limiter = new SignUpRateLimiter(1, 60);

    expect(limiter.consume("ip").allowed).toBe(true);
    expect(limiter.consume("ip").allowed).toBe(false);

    vi.advanceTimersByTime(60_001);

    expect(limiter.consume("ip").allowed).toBe(true);
  });

  it("deve isolar o limite por chave", () => {
    const limiter = new SignUpRateLimiter(1, 60);

    expect(limiter.consume("ip-a").allowed).toBe(true);
    expect(limiter.consume("ip-a").allowed).toBe(false);
    expect(limiter.consume("ip-b").allowed).toBe(true);
  });

  it("deve limpar o estado no reset usado pelos testes", () => {
    const limiter = new SignUpRateLimiter(1, 60);

    limiter.consume("ip");
    expect(limiter.consume("ip").allowed).toBe(false);

    limiter.reset();

    expect(limiter.consume("ip").allowed).toBe(true);
  });
});
