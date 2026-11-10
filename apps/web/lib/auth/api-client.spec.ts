import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cookieValue = vi.hoisted(() => ({
  current: undefined as string | undefined,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieValue.current === undefined
        ? undefined
        : { name, value: cookieValue.current },
  }),
}));

import {
  DEFAULT_API_BASE_URL,
  fetchApiWithSession,
  getApiBaseUrl,
  getBearerToken,
} from "./api-client";

describe("getBearerToken", () => {
  afterEach(() => {
    cookieValue.current = undefined;
  });

  it("deve devolver o valor do cookie de sessão", async () => {
    cookieValue.current = "jwt-value";

    await expect(getBearerToken()).resolves.toBe("jwt-value");
  });

  it("deve devolver nulo quando não há cookie", async () => {
    cookieValue.current = undefined;

    await expect(getBearerToken()).resolves.toBeNull();
  });
});

describe("getApiBaseUrl", () => {
  const original = process.env.API_BASE_URL;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.API_BASE_URL;
    } else {
      process.env.API_BASE_URL = original;
    }
  });

  it("deve usar API_BASE_URL quando configurada", () => {
    process.env.API_BASE_URL = "http://api.example.test";

    expect(getApiBaseUrl()).toBe("http://api.example.test");
  });

  it("deve usar o padrão local quando não configurada", () => {
    delete process.env.API_BASE_URL;

    expect(getApiBaseUrl()).toBe(DEFAULT_API_BASE_URL);
    expect(DEFAULT_API_BASE_URL).toBe("http://localhost:3333");
  });
});

describe("fetchApiWithSession", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    process.env.API_BASE_URL = "http://localhost:3333";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cookieValue.current = undefined;
  });

  it("deve encaminhar o cookie como Authorization: Bearer", async () => {
    cookieValue.current = "jwt-value";

    await fetchApiWithSession("/api/v1/auth/me");

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe("http://localhost:3333/api/v1/auth/me");
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer jwt-value",
    );
  });

  it("não deve montar Authorization quando não há cookie", async () => {
    cookieValue.current = undefined;

    await fetchApiWithSession("/api/v1/hello");

    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(new Headers(init.headers).get("Authorization")).toBeNull();
  });

  it("deve preservar headers e opções informadas", async () => {
    cookieValue.current = "jwt-value";

    await fetchApiWithSession("/api/v1/auth/me", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });

    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBe("{}");
    expect(new Headers(init.headers).get("Content-Type")).toBe(
      "application/json",
    );
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer jwt-value",
    );
  });
});
