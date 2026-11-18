import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTraceSpan, type TraceSpan } from "../domain/trace-span";
import { HttpTraceSink, toLangSmithRun } from "./http-trace.sink";

type CapturedRequest = {
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body: Record<string, unknown>;
};

function makeSpan(
  overrides: Partial<Parameters<typeof createTraceSpan>[0]> = {},
): TraceSpan {
  return createTraceSpan({
    id: "span-1",
    traceId: "trace-1",
    name: "expert.chat",
    kind: "chat",
    startedAt: Date.parse("2026-11-18T12:00:00.000Z"),
    endedAt: Date.parse("2026-11-18T12:00:00.050Z"),
    status: "ok",
    conversationId: "conversation-1",
    messageId: "message-1",
    expertId: "cto",
    userPseudonym: "u_hash",
    modelId: "gpt-4o-mini",
    metadata: { password: "synthetic-secret", topK: 5 },
    ...overrides,
  });
}

describe("HttpTraceSink", () => {
  let server: Server;
  let origin: string;
  let statusCode: number;
  let requests: CapturedRequest[];
  let sink: HttpTraceSink | null;

  beforeEach(async () => {
    statusCode = 200;
    requests = [];
    sink = null;
    server = createServer((request, response) => {
      const chunks: Buffer[] = [];

      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        requests.push({
          url: request.url ?? "",
          headers: request.headers,
          body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<
            string,
            unknown
          >,
        });
        response.writeHead(statusCode, { "content-type": "application/json" });
        response.end("{}");
      });
    });

    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address() as AddressInfo;

    origin = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    if (sink !== null) await sink.flush();

    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  it("envia spans ao endpoint local sem conteúdo sensível", async () => {
    sink = new HttpTraceSink({
      endpoint: origin,
      apiKey: "test-local-key",
      batchSize: 10,
      flushIntervalMs: 5_000,
      timeoutMs: 500,
    });

    await sink.send(makeSpan());
    await sink.flush();

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("/runs");
    expect(requests[0]?.headers["x-api-key"]).toBe("test-local-key");
    expect(requests[0]?.body).toMatchObject({
      id: "span-1",
      name: "expert.chat",
      run_type: "chain",
      start_time: "2026-11-18T12:00:00.000Z",
      end_time: "2026-11-18T12:00:00.050Z",
      status: "completed",
      inputs: {},
      outputs: {},
      extra: {
        metadata: {
          schemaVersion: 1,
          conversationId: "conversation-1",
          messageId: "message-1",
          expertId: "cto",
          userPseudonym: "u_hash",
          modelId: "gpt-4o-mini",
          topK: 5,
        },
      },
    });
    expect(JSON.stringify(requests[0]?.body)).not.toContain("synthetic-secret");
  });

  it("descarta o span com aviso quando o coletor falha", async () => {
    statusCode = 500;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    sink = new HttpTraceSink({
      endpoint: origin,
      apiKey: "test-local-key",
      batchSize: 10,
      flushIntervalMs: 5_000,
      timeoutMs: 500,
    });

    await sink.send(makeSpan());
    await sink.flush();

    const lines = warn.mock.calls.map((call) => String(call[0]));

    expect(lines.some((line) => line.includes("obs.trace.dropped"))).toBe(true);
    warn.mockRestore();
  });

  it("envia os spans enfileirados ao atingir o tamanho do lote", async () => {
    sink = new HttpTraceSink({
      endpoint: origin,
      apiKey: "test-local-key",
      batchSize: 2,
      flushIntervalMs: 5_000,
      timeoutMs: 500,
    });

    await sink.send(makeSpan({ id: "span-1" }));
    await sink.send(makeSpan({ id: "span-2" }));
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(requests.map((request) => request.body.id)).toEqual([
      "span-1",
      "span-2",
    ]);
  });
});

describe("toLangSmithRun", () => {
  it("mapeia os tipos de span para run_type do LangSmith", () => {
    expect(toLangSmithRun(makeSpan({ kind: "chat" })).run_type).toBe("chain");
    expect(toLangSmithRun(makeSpan({ kind: "retrieval" })).run_type).toBe(
      "retriever",
    );
    expect(toLangSmithRun(makeSpan({ kind: "generation" })).run_type).toBe(
      "llm",
    );
  });

  it("marca spans com erro como error", () => {
    expect(toLangSmithRun(makeSpan({ status: "error" })).status).toBe("error");
  });
});
