import { describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => store,
}));

import {
  DEFAULT_SESSION_TTL_SECONDS,
  SESSION_COOKIE_NAME,
  createSessionCookieOptions,
  setSessionCookie,
} from "./session-cookie";

describe("createSessionCookieOptions", () => {
  it("deve usar o nome de cookie definido no plano", () => {
    expect(SESSION_COOKIE_NAME).toBe("session_token");
  });

  it("deve gerar opções HttpOnly, SameSite=Lax, Path=/ e Max-Age", () => {
    expect(createSessionCookieOptions(3600, false)).toEqual({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 3600,
      secure: false,
    });
  });

  it("deve marcar Secure em produção", () => {
    expect(createSessionCookieOptions(3600, true).secure).toBe(true);
  });

  it("deve usar a duração padrão quando não informada", () => {
    expect(createSessionCookieOptions(undefined, false).maxAge).toBe(
      DEFAULT_SESSION_TTL_SECONDS,
    );
    expect(DEFAULT_SESSION_TTL_SECONDS).toBe(604_800);
  });
});

describe("setSessionCookie", () => {
  it("deve gravar o token com as opções do cookie", async () => {
    store.set.mockClear();

    await setSessionCookie("jwt-value", 7200);

    expect(store.set).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      "jwt-value",
      createSessionCookieOptions(7200),
    );
  });
});
