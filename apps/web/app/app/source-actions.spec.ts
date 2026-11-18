import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchApi = vi.hoisted(() => ({ mock: vi.fn() }));

vi.mock("../../lib/auth/api-client", () => ({
  fetchApiWithSession: fetchApi.mock,
}));

import {
  ALREADY_CONNECTED_MESSAGE,
  CONNECT_SOURCES_PATH,
  CONNECT_SOURCE_URL_PATH,
  SESSION_EXPIRED_MESSAGE,
  SOURCE_CONNECT_FAILED_MESSAGE,
  SOURCE_DELETE_FAILED_MESSAGE,
  SOURCE_LOAD_FAILED_MESSAGE,
  SOURCE_URL_CONNECT_FAILED_MESSAGE,
  SOURCE_URL_REQUIRED_MESSAGE,
  type ConnectSourcesResponse,
  type ListSourcesResponse,
} from "../../lib/knowledge/types";
import {
  connectSourceUrlAction,
  connectSourcesAction,
  deleteSourceAction,
  listSourcesAction,
  retrySourceVersionAction,
} from "./source-actions";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const source = {
  id: "source-1",
  name: "notes.txt",
  type: "txt" as const,
  byteSize: 12,
  status: "ready" as const,
  versionId: "version-1",
  versionNumber: 1,
  chunkCount: 1,
  isStale: false,
  createdAt: "2026-11-18T12:00:00.000Z",
};

const listBody: ListSourcesResponse = { sources: [source] };
const connectBody: ConnectSourcesResponse = {
  results: [
    {
      name: "notes.txt",
      type: "txt",
      byteSize: 12,
      sourceId: source.id,
      versionId: source.versionId,
      status: "processing",
      alreadyConnected: false,
    },
  ],
};

function upload(name = "notes.txt"): FormData {
  const formData = new FormData();

  formData.append("files", new File(["context"], name, { type: "text/plain" }));

  return formData;
}

beforeEach(() => {
  fetchApi.mock.mockReset();
});

describe("listSourcesAction", () => {
  it("devolve a lista da API sem expor o token", async () => {
    fetchApi.mock.mockResolvedValue(jsonResponse(200, listBody));

    await expect(listSourcesAction()).resolves.toEqual({
      ok: true,
      data: listBody,
    });
    expect(fetchApi.mock).toHaveBeenCalledWith(CONNECT_SOURCES_PATH, {
      cache: "no-store",
    });
  });

  it("mapeia sessão expirada e falha de rede para mensagens próprias", async () => {
    fetchApi.mock.mockResolvedValueOnce(
      jsonResponse(401, { code: "UNAUTHORIZED", message: "JWT expired" }),
    );
    fetchApi.mock.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    await expect(listSourcesAction()).resolves.toEqual({
      ok: false,
      message: SESSION_EXPIRED_MESSAGE,
    });
    await expect(listSourcesAction()).resolves.toEqual({
      ok: false,
      message: SOURCE_LOAD_FAILED_MESSAGE,
    });
  });
});

describe("connectSourcesAction", () => {
  it("repassa o multipart e devolve o resultado", async () => {
    fetchApi.mock.mockResolvedValue(jsonResponse(202, connectBody));
    const formData = upload();

    const result = await connectSourcesAction(formData);

    expect(result).toEqual({ ok: true, data: connectBody });
    const [path, init] = fetchApi.mock.mock.calls[0] as [string, RequestInit];

    expect(path).toBe(CONNECT_SOURCES_PATH);
    expect(init.method).toBe("POST");
    expect(init.body).toBe(formData);
    expect(init.headers).toBeUndefined();
  });

  it("informa Already connected quando todos os arquivos são deduplicados", async () => {
    fetchApi.mock.mockResolvedValue(
      jsonResponse(202, {
        results: [
          {
            ...connectBody.results[0],
            alreadyConnected: true,
            status: "ready",
          },
        ],
      }),
    );

    const result = await connectSourcesAction(upload());

    expect(result).toMatchObject({
      ok: true,
      message: ALREADY_CONNECTED_MESSAGE,
    });
  });

  it("rejeita tipo inválido no servidor web sem chamar a API", async () => {
    const result = await connectSourcesAction(upload("malware.exe"));

    expect(result).toEqual({
      ok: false,
      message: "Only PDF, TXT or Markdown files are supported.",
    });
    expect(fetchApi.mock).not.toHaveBeenCalled();
  });

  it("repassa mensagem pública da API sem detalhes internos", async () => {
    fetchApi.mock.mockResolvedValue(
      jsonResponse(413, {
        code: "SOURCE_FILE_TOO_LARGE",
        message: "One of the files is too large. Try a smaller file.",
      }),
    );

    await expect(connectSourcesAction(upload())).resolves.toEqual({
      ok: false,
      message: "One of the files is too large. Try a smaller file.",
    });
  });

  it("não propaga erro interno da API", async () => {
    fetchApi.mock.mockResolvedValue(
      jsonResponse(503, { code: "DB_DOWN", message: "password in stack" }),
    );

    await expect(connectSourcesAction(upload())).resolves.toEqual({
      ok: false,
      message: SOURCE_CONNECT_FAILED_MESSAGE,
    });
  });
});

describe("connectSourceUrlAction", () => {
  const url = "https://example.com/guide";
  const urlBody: ConnectSourcesResponse = {
    results: [
      {
        name: "guide",
        type: "txt",
        byteSize: 42,
        sourceId: source.id,
        versionId: source.versionId,
        status: "processing",
        alreadyConnected: false,
        url,
      },
    ],
  };

  it("envia a URL como JSON ao endpoint de URLs sem expor o token", async () => {
    fetchApi.mock.mockResolvedValue(jsonResponse(202, urlBody));

    await expect(connectSourceUrlAction(`  ${url}  `)).resolves.toEqual({
      ok: true,
      data: urlBody,
    });
    expect(fetchApi.mock).toHaveBeenCalledWith(CONNECT_SOURCE_URL_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      cache: "no-store",
    });
  });

  it("informa Already connected quando a URL já foi indexada", async () => {
    fetchApi.mock.mockResolvedValue(
      jsonResponse(202, {
        results: [
          {
            ...urlBody.results[0],
            alreadyConnected: true,
            status: "ready",
          },
        ],
      }),
    );

    await expect(connectSourceUrlAction(url)).resolves.toMatchObject({
      ok: true,
      message: ALREADY_CONNECTED_MESSAGE,
    });
  });

  it("rejeita URL vazia sem chamar a API", async () => {
    await expect(connectSourceUrlAction("   ")).resolves.toEqual({
      ok: false,
      message: SOURCE_URL_REQUIRED_MESSAGE,
    });
    expect(fetchApi.mock).not.toHaveBeenCalled();
  });

  it.each([
    ["INVALID_SOURCE_URL", 400, "Enter a valid public http or https URL."],
    ["BLOCKED_SOURCE_URL", 400, "That address is not allowed."],
    ["SOURCE_URL_NO_TEXT", 422, "The page has no text we can index."],
    ["SOURCE_URL_TOO_LARGE", 413, "The page is too large to index."],
    ["SOURCE_URL_UNAVAILABLE", 503, SOURCE_URL_CONNECT_FAILED_MESSAGE],
  ])("trata %s com mensagem pública segura", async (code, status, message) => {
    fetchApi.mock.mockResolvedValue(jsonResponse(status, { code, message }));

    await expect(connectSourceUrlAction(url)).resolves.toEqual({
      ok: false,
      message,
    });
  });

  it("mapeia sessão expirada e falha de rede para mensagens próprias", async () => {
    fetchApi.mock.mockResolvedValueOnce(
      jsonResponse(401, { code: "UNAUTHORIZED", message: "JWT expired" }),
    );
    fetchApi.mock.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    await expect(connectSourceUrlAction(url)).resolves.toEqual({
      ok: false,
      message: SESSION_EXPIRED_MESSAGE,
    });
    await expect(connectSourceUrlAction(url)).resolves.toEqual({
      ok: false,
      message: SOURCE_URL_CONNECT_FAILED_MESSAGE,
    });
  });

  it("não propaga erro interno da API", async () => {
    fetchApi.mock.mockResolvedValue(
      jsonResponse(500, { code: "DB_DOWN", message: "password in stack" }),
    );

    await expect(connectSourceUrlAction(url)).resolves.toEqual({
      ok: false,
      message: SOURCE_URL_CONNECT_FAILED_MESSAGE,
    });
  });
});

describe("source management actions", () => {
  it("exclui a fonte com id codificado na URL", async () => {
    fetchApi.mock.mockResolvedValue(new Response(null, { status: 204 }));

    const result = await deleteSourceAction("source 1");

    expect(result).toEqual({
      ok: true,
      data: { id: "source 1", deleted: true },
    });
    expect(fetchApi.mock).toHaveBeenCalledWith(
      `${CONNECT_SOURCES_PATH}/source%201`,
      { method: "DELETE", cache: "no-store" },
    );
  });

  it("mapeia falha de exclusão", async () => {
    fetchApi.mock.mockRejectedValue(new Error("network down"));

    await expect(deleteSourceAction("source-1")).resolves.toEqual({
      ok: false,
      message: SOURCE_DELETE_FAILED_MESSAGE,
    });
  });

  it("reenvia retry para a versão correta", async () => {
    fetchApi.mock.mockResolvedValue(
      jsonResponse(202, { status: "processing" }),
    );

    const result = await retrySourceVersionAction("version-1");

    expect(result).toEqual({
      ok: true,
      data: { versionId: "version-1", status: "processing" },
    });
    expect(fetchApi.mock).toHaveBeenCalledWith(
      `${CONNECT_SOURCES_PATH}/version-1/retry`,
      { method: "POST", cache: "no-store" },
    );
  });
});
