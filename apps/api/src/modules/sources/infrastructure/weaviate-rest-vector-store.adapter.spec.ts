import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { VectorRecord } from "../application/ports/vector-store.port";
import type { Chunk } from "../domain/source";
import { SourceVectorStoreError } from "../domain/source.errors";

import { WeaviateRestVectorStoreAdapter } from "./weaviate-rest-vector-store.adapter";

type CapturedRequest = {
  method: string;
  url: string;
  body: unknown;
};

const USER_ID = "11111111-1111-1111-1111-111111111111";
const SOURCE_ID = "22222222-2222-2222-2222-222222222222";
const VERSION_ID = "33333333-3333-3333-3333-333333333333";

const chunk: Chunk = {
  id: "44444444-4444-4444-4444-444444444444",
  sourceId: SOURCE_ID,
  sourceVersionId: VERSION_ID,
  userId: USER_ID,
  index: 0,
  content: "explicit context",
};

const record: VectorRecord = { chunk, vector: [0.1, 0.2] };

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

describe("WeaviateRestVectorStoreAdapter", () => {
  let server: Server;
  let adapter: WeaviateRestVectorStoreAdapter;
  let requests: CapturedRequest[];
  let collectionStatus: number;
  let graphqlBody: unknown;

  beforeEach(async () => {
    requests = [];
    collectionStatus = 404;
    graphqlBody = {
      data: {
        Get: {
          KnowledgeChunk: [{ _additional: { id: chunk.id } }],
        },
      },
    };

    server = createServer(async (request, response) => {
      const body = await readBody(request);
      requests.push({
        method: request.method ?? "",
        url: request.url ?? "",
        body,
      });

      if (request.url === "/v1/schema/KnowledgeChunk") {
        json(response, collectionStatus, {});
        return;
      }
      if (request.url === "/v1/schema" && request.method === "POST") {
        json(response, 201, {});
        return;
      }
      if (request.url === "/v1/objects" && request.method === "POST") {
        json(response, 200, {});
        return;
      }
      if (request.url === "/v1/graphql" && request.method === "POST") {
        json(response, 200, graphqlBody);
        return;
      }
      if (
        request.url?.startsWith("/v1/objects/KnowledgeChunk/") &&
        request.method === "DELETE"
      ) {
        json(response, 204, {});
        return;
      }

      json(response, 404, {});
    });

    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );

    const address = server.address() as AddressInfo;
    adapter = new WeaviateRestVectorStoreAdapter(
      `http://127.0.0.1:${address.port}`,
    );
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) =>
        error === undefined ? resolve() : reject(error),
      ),
    );
  });

  it("cria a collection com vectorizer desligado e distância cosine", async () => {
    await adapter.ensureCollection();

    const create = requests[1];
    expect(create?.method).toBe("POST");
    expect(create?.url).toBe("/v1/schema");
    expect(create?.body).toMatchObject({
      class: "KnowledgeChunk",
      vectorizer: "none",
      vectorIndexConfig: { distance: "cosine" },
    });
  });

  it("não recria uma collection existente", async () => {
    collectionStatus = 200;

    await adapter.ensureCollection();

    expect(requests).toHaveLength(1);
  });

  it("usa o mesmo id de objeto para reenvio do mesmo chunk", async () => {
    await adapter.upsert(USER_ID, [record]);
    await adapter.upsert(USER_ID, [record]);

    const first = requests[0]?.body as { id?: string };
    const second = requests[1]?.body as { id?: string };

    expect(first.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(second.id).toBe(first.id);
    expect(first).toMatchObject({
      class: "KnowledgeChunk",
      vector: [0.1, 0.2],
      properties: {
        userId: USER_ID,
        sourceId: SOURCE_ID,
        sourceVersionId: VERSION_ID,
        chunkId: chunk.id,
        chunkIndex: 0,
      },
    });
  });

  it("busca e remove vetores filtrando por usuário e fonte", async () => {
    await adapter.deleteSource(USER_ID, SOURCE_ID);

    const query = requests[0]?.body as { query?: string };

    expect(query.query).toContain(`valueText: "${USER_ID}"`);
    expect(query.query).toContain(`valueText: "${SOURCE_ID}"`);
    expect(requests[1]).toMatchObject({
      method: "DELETE",
      url: `/v1/objects/KnowledgeChunk/${chunk.id}`,
    });
  });

  it("transforma falha HTTP em erro público do domínio", async () => {
    collectionStatus = 500;

    await expect(adapter.ensureCollection()).rejects.toBeInstanceOf(
      SourceVectorStoreError,
    );
  });

  it("rejeita resposta GraphQL com erros", async () => {
    graphqlBody = { errors: [{ message: "bad query" }] };

    await expect(
      adapter.deleteVersion(USER_ID, VERSION_ID),
    ).rejects.toBeInstanceOf(SourceVectorStoreError);
  });
});
