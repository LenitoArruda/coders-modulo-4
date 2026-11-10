import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getBearerToken: vi.fn(),
  fetchApiWithSession: vi.fn(),
}));

vi.mock("./api-client", () => api);

import { AUTH_ME_PATH, getSessionUser, type SessionUser } from "./session";

const user: SessionUser = {
  id: "11111111-1111-1111-1111-111111111111",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("getSessionUser", () => {
  beforeEach(() => {
    api.getBearerToken.mockReset().mockResolvedValue("jwt-value");
    api.fetchApiWithSession.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("não deve chamar a API quando não há cookie de sessão", async () => {
    api.getBearerToken.mockResolvedValue(null);

    await expect(getSessionUser()).resolves.toBeNull();
    expect(api.fetchApiWithSession).not.toHaveBeenCalled();
  });

  it("deve devolver a pessoa quando a API responde 200 com o shape esperado", async () => {
    api.fetchApiWithSession.mockResolvedValue(jsonResponse({ user }));

    await expect(getSessionUser()).resolves.toEqual(user);
    expect(api.fetchApiWithSession).toHaveBeenCalledWith(AUTH_ME_PATH, {
      cache: "no-store",
    });
  });

  it("deve tratar 401 como ausência de sessão", async () => {
    api.fetchApiWithSession.mockResolvedValue(
      jsonResponse(
        {
          code: "UNAUTHORIZED",
          message: "Your session is invalid or has expired. Sign in again.",
        },
        401,
      ),
    );

    await expect(getSessionUser()).resolves.toBeNull();
  });

  it("deve tratar resposta 200 com shape inválido como ausência de sessão", async () => {
    api.fetchApiWithSession.mockResolvedValue(jsonResponse({ user: null }));

    await expect(getSessionUser()).resolves.toBeNull();
  });

  it("deve tratar falha de rede como ausência de sessão", async () => {
    api.fetchApiWithSession.mockRejectedValue(new Error("connection refused"));

    await expect(getSessionUser()).resolves.toBeNull();
  });

  it("deve tratar JSON inválido como ausência de sessão", async () => {
    api.fetchApiWithSession.mockResolvedValue(new Response("not-json"));

    await expect(getSessionUser()).resolves.toBeNull();
  });
});
