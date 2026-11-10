import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { CryptoOpaqueTokenAdapter } from "./crypto-opaque-token.adapter";

describe("CryptoOpaqueTokenAdapter", () => {
  it("deve gerar tokens opacos distintos de alta entropia", () => {
    const adapter = new CryptoOpaqueTokenAdapter();

    const first = adapter.generate();
    const second = adapter.generate();

    expect(first.token).not.toBe(second.token);
    expect(first.token).toHaveLength(43);
    expect(first.token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(first.hash).not.toBe(first.token);
  });

  it("deve gerar hash SHA-256 determinístico do token", () => {
    const adapter = new CryptoOpaqueTokenAdapter();
    const generated = adapter.generate();

    const expected = createHash("sha256").update(generated.token).digest("hex");

    expect(generated.hash).toBe(expected);
    expect(adapter.hash(generated.token)).toBe(expected);
  });
});
