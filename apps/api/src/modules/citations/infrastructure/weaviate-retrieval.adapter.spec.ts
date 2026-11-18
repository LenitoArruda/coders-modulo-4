import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { KnowledgeRetrievalError } from "../domain/citation.errors";

import { WeaviateRetrievalAdapter } from "./weaviate-retrieval.adapter";

type CapturedRequest = { method: string; url: string; body: unknown };

const USER_ID = "11111111-1111-1111-1111-111111111111";

function json(
  response: ServerResponse<IncomingMessage>,
  status: number,
  body: unknown,
): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const parts: Buffer[] = [];

  for await (const part of request) {
    parts.push(Buffer.from(part));
  }

  const text = Buffer.concat(parts).toString("utf8");

  return text === "" ? null : JSON.parse(text);
}

describe("WeaviateRetrievalAdapter", () => {
  let server: Server;
  let adapter: WeaviateRetrievalAdapter;
  let requests: CapturedRequest[];
  let status: number;
  let graphqlBody: unknown;

  beforeEach(async () => {
    requests = [];
    status = 200;
    graphqlBody = {
      data: {
        Get: {
          KnowledgeChunk: [
            {
              content: "Ship in small batches.",
              sourceId: "source-1",
              sourceVersionId: "version-1",
              chunkId: "chunk-1",
              chunkIndex: 2,
              _additional: { certainty: 0.87 },
            },
          ],
        },
      },
    };

    server = createServer(async (request, response) => {
      requests.push({
        method: request.method ?? "",
        url: request.url ?? "",
        body: await readBody(request),
      });

      if (request.url === "/v1/graphql" && request.method === "POST") {
        json(response, status, graphqlBody);
        return;
      }

      json(response, 404, {});
    });

    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );

    const address = server.address() as AddressInfo;
    adapter = new WeaviateRetrievalAdapter(`http://127.0.0.1:${address.port}`);
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) =>
        error === undefined ? resolve() : reject(error),
      ),
    );
  });

  it("busca vetores escopados pelo usuário e mapeia os hits", async () => {
    const hits = await adapter.search(USER_ID, [0.1, 0.2], 5);

    const body = requests[0]?.body as { query?: string };

    expect(requests[0]).toMatchObject({
      method: "POST",
      url: "/v1/graphql",
    });
    expect(body.query).toContain(`valueText: "${USER_ID}"`);
    expect(body.query).toContain("nearVector: { vector: [0.1,0.2] }");
    expect(body.query).toContain("limit: 5");
    expect(hits).toEqual([
      {
        chunkId: "chunk-1",
        sourceId: "source-1",
        sourceVersionId: "version-1",
        chunkIndex: 2,
        content: "Ship in small batches.",
        score: 0.87,
      },
    ]);
  });

  it("usa o score quando certainty não está disponível", async () => {
    graphqlBody = {
      data: {
        Get: {
          KnowledgeChunk: [
            {
              content: "text",
              sourceId: "source-1",
              sourceVersionId: "version-1",
              chunkId: "chunk-1",
              chunkIndex: 0,
              _additional: { score: 0.72 },
            },
          ],
        },
      },
    };

    const hits = await adapter.search(USER_ID, [0.1], 1);

    expect(hits[0]?.score).toBe(0.72);
  });

  it("rejeita entradas inválidas sem chamar o vetor store", async () => {
    await expect(adapter.search("", [0.1], 5)).rejects.toBeInstanceOf(
      KnowledgeRetrievalError,
    );
    await expect(adapter.search(USER_ID, [], 5)).rejects.toBeInstanceOf(
      KnowledgeRetrievalError,
    );
    await expect(adapter.search(USER_ID, [0.1], 0)).rejects.toBeInstanceOf(
      KnowledgeRetrievalError,
    );
    expect(requests).toHaveLength(0);
  });

  it("transforma falha HTTP em erro público do domínio", async () => {
    status = 500;

    await expect(adapter.search(USER_ID, [0.1], 5)).rejects.toBeInstanceOf(
      KnowledgeRetrievalError,
    );
  });

  it("rejeita resposta GraphQL com erros", async () => {
    graphqlBody = { errors: [{ message: "bad query" }] };

    await expect(adapter.search(USER_ID, [0.1], 5)).rejects.toBeInstanceOf(
      KnowledgeRetrievalError,
    );
  });

  it("rejeita registros incompletos", async () => {
    graphqlBody = {
      data: {
        Get: {
          KnowledgeChunk: [
            {
              content: "text",
              sourceId: "source-1",
              sourceVersionId: "version-1",
              chunkId: "",
              chunkIndex: 0,
            },
          ],
        },
      },
    };

    await expect(adapter.search(USER_ID, [0.1], 5)).rejects.toBeInstanceOf(
      KnowledgeRetrievalError,
    );
  });
});
