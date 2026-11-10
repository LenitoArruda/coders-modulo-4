import { describe, expect, it } from "vitest";

import {
  CORS_ALLOWED_HEADERS,
  CORS_METHODS,
  isAllowedCorsOrigin,
} from "./cors";

const WEB_ORIGIN = "http://localhost:3000";

describe("isAllowedCorsOrigin", () => {
  it("deve aceitar a origem configurada do web", () => {
    expect(isAllowedCorsOrigin(WEB_ORIGIN, WEB_ORIGIN)).toBe(true);
  });

  it("deve aceitar requisições sem Origin", () => {
    expect(isAllowedCorsOrigin(undefined, WEB_ORIGIN)).toBe(true);
  });

  it("não deve aceitar outra origem", () => {
    expect(isAllowedCorsOrigin("http://malicious.example", WEB_ORIGIN)).toBe(
      false,
    );
  });

  it("não deve aceitar origem parecida ou com caminho", () => {
    expect(isAllowedCorsOrigin("http://localhost:3001", WEB_ORIGIN)).toBe(
      false,
    );
    expect(isAllowedCorsOrigin(`${WEB_ORIGIN}/auth`, WEB_ORIGIN)).toBe(false);
  });

  it("não deve aceitar origem quando a allowlist está vazia", () => {
    expect(isAllowedCorsOrigin(WEB_ORIGIN, "")).toBe(false);
  });
});

describe("CORS_METHODS", () => {
  it("deve cobrir leitura, preflight e o POST do fluxo de auth", () => {
    expect([...CORS_METHODS]).toEqual(["GET", "HEAD", "POST", "OPTIONS"]);
  });
});

describe("CORS_ALLOWED_HEADERS", () => {
  it("deve permitir Authorization e Content-Type", () => {
    expect([...CORS_ALLOWED_HEADERS]).toEqual([
      "Authorization",
      "Content-Type",
    ]);
  });
});
