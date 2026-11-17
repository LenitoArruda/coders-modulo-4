import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchApi = vi.hoisted(() => ({ mock: vi.fn() }));

vi.mock("../../lib/auth/api-client", () => ({
  fetchApiWithSession: fetchApi.mock,
}));

import {
  listExpertsAction,
  loadConversationAction,
  sendPromptAction,
} from "./chat-actions";
import {
  EMPTY_PROMPT_MESSAGE,
  LOAD_FAILED_MESSAGE,
  PROMPT_TOO_LONG_MESSAGE,
  SEND_FAILED_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  PROMPT_MAX_LENGTH,
} from "../../lib/expert-chat/types";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const expert = {
  id: "cto",
  name: "CTO Expert",
  role: "Technology & Engineering",
  scope: "Technology leadership.",
  tone: "Technical.",
  suggestions: ["A question?"],
};

const exchange = {
  conversationId: "conv-1",
  userMessage: {
    id: "m1",
    role: "user" as const,
    content: "Hello",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  expertMessage: {
    id: "m2",
    role: "expert" as const,
    content: "Hi",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
};

beforeEach(() => {
  fetchApi.mock.mockReset();
});

describe("listExpertsAction", () => {
  it("devolve o catálogo vindo da API", async () => {
    fetchApi.mock.mockResolvedValue(jsonResponse(200, { experts: [expert] }));

    const result = await listExpertsAction();

    expect(result).toEqual({ ok: true, data: { experts: [expert] } });
    expect(fetchApi.mock).toHaveBeenCalledWith("/api/v1/experts", {
      cache: "no-store",
    });
  });

  it("devolve mensagem genérica quando a API falha", async () => {
    fetchApi.mock.mockResolvedValue(jsonResponse(500, { code: "DB_DOWN" }));

    await expect(listExpertsAction()).resolves.toEqual({
      ok: false,
      message: LOAD_FAILED_MESSAGE,
    });
  });

  it("não vaza detalhes técnicos quando a rede falha", async () => {
    fetchApi.mock.mockRejectedValue(new Error("ECONNREFUSED 10.0.0.5:5432"));

    await expect(listExpertsAction()).resolves.toEqual({
      ok: false,
      message: LOAD_FAILED_MESSAGE,
    });
  });
});

describe("loadConversationAction", () => {
  it("reenvia o expertId e devolve o histórico", async () => {
    fetchApi.mock.mockResolvedValue(
      jsonResponse(200, { conversationId: "conv-1", messages: [] }),
    );

    const result = await loadConversationAction(" cto ");

    expect(result).toEqual({
      ok: true,
      data: { conversationId: "conv-1", messages: [] },
    });
    expect(fetchApi.mock).toHaveBeenCalledWith(
      "/api/v1/conversations?expertId=cto",
      { cache: "no-store" },
    );
  });

  it("sinaliza sessão expirada sem repassar a mensagem da API", async () => {
    fetchApi.mock.mockResolvedValue(
      jsonResponse(401, {
        code: "UNAUTHORIZED",
        message: "JWT expired at ...",
      }),
    );

    await expect(loadConversationAction("cto")).resolves.toEqual({
      ok: false,
      message: SESSION_EXPIRED_MESSAGE,
    });
  });
});

describe("sendPromptAction", () => {
  it("envia o prompt e devolve a troca persistida", async () => {
    fetchApi.mock.mockResolvedValue(jsonResponse(201, exchange));

    const result = await sendPromptAction("cto", " Hello ", "typed");

    expect(result).toEqual({ ok: true, data: exchange });
    const [path, init] = fetchApi.mock.mock.calls[0] as [string, RequestInit];

    expect(path).toBe("/api/v1/conversations/messages");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      expertId: "cto",
      prompt: "Hello",
      source: "typed",
    });
  });

  it("rejeita prompt vazio sem chamar a API", async () => {
    const result = await sendPromptAction("cto", "   ");

    expect(result).toEqual({
      ok: false,
      message: "Check your message and try again.",
      fieldErrors: { prompt: EMPTY_PROMPT_MESSAGE },
    });
    expect(fetchApi.mock).not.toHaveBeenCalled();
  });

  it("rejeita prompt longo sem chamar a API", async () => {
    const result = await sendPromptAction(
      "cto",
      "x".repeat(PROMPT_MAX_LENGTH + 1),
    );

    expect(result).toEqual({
      ok: false,
      message: "Check your message and try again.",
      fieldErrors: { prompt: PROMPT_TOO_LONG_MESSAGE },
    });
    expect(fetchApi.mock).not.toHaveBeenCalled();
  });

  it("mapeia 503 para mensagem acionável, sem detalhes do modelo", async () => {
    fetchApi.mock.mockResolvedValue(
      jsonResponse(503, {
        code: "MODEL_UNAVAILABLE",
        message: "OpenAI 429 rate limit on gpt-4o-mini",
      }),
    );

    await expect(sendPromptAction("cto", "question")).resolves.toEqual({
      ok: false,
      message: SEND_FAILED_MESSAGE,
    });
  });

  it("repassa fieldErrors de validação em 400", async () => {
    fetchApi.mock.mockResolvedValue(
      jsonResponse(400, {
        code: "VALIDATION_ERROR",
        message: "Check your message and try again.",
        fieldErrors: { prompt: EMPTY_PROMPT_MESSAGE },
      }),
    );

    await expect(sendPromptAction("cto", "question")).resolves.toEqual({
      ok: false,
      message: "Check your message and try again.",
      fieldErrors: { prompt: EMPTY_PROMPT_MESSAGE },
    });
  });

  it("nunca inclui o token do cookie na chamada", async () => {
    fetchApi.mock.mockResolvedValue(jsonResponse(201, exchange));

    await sendPromptAction("cto", "question");

    const [, init] = fetchApi.mock.mock.calls[0] as [string, RequestInit];

    expect(JSON.stringify(init)).not.toContain("Authorization");
    expect(JSON.stringify(init)).not.toContain("Bearer");
    expect(JSON.stringify(init)).not.toContain("session_token");
  });
});
