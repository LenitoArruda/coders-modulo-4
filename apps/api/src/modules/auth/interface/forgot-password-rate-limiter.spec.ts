import { describe, expect, it } from "vitest";

import { ForgotPasswordRateLimiter } from "./forgot-password-rate-limiter";

describe("ForgotPasswordRateLimiter", () => {
  it("deve permitir até o limite e bloquear a próxima tentativa", () => {
    const limiter = new ForgotPasswordRateLimiter(3, 60);

    expect(limiter.consume("ip:1.2.3.4")).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
    expect(limiter.consume("ip:1.2.3.4").allowed).toBe(true);
    expect(limiter.consume("ip:1.2.3.4").allowed).toBe(true);

    const blocked = limiter.consume("ip:1.2.3.4");

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("deve isolar tentativas por chave", () => {
    const limiter = new ForgotPasswordRateLimiter(1, 60);

    expect(limiter.consume("ip:1.2.3.4").allowed).toBe(true);
    expect(limiter.consume("ip:1.2.3.4").allowed).toBe(false);

    expect(limiter.consume("ip:5.6.7.8").allowed).toBe(true);
    expect(limiter.consume("email:ada@example.com").allowed).toBe(true);
  });

  it("deve liberar a chave após o reset", () => {
    const limiter = new ForgotPasswordRateLimiter(1, 60);

    limiter.consume("email:ada@example.com");
    expect(limiter.consume("email:ada@example.com").allowed).toBe(false);

    limiter.reset();

    expect(limiter.consume("email:ada@example.com").allowed).toBe(true);
  });
});
