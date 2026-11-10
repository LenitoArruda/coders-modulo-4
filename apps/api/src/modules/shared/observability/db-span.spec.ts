import {
  SpanKind,
  SpanStatusCode,
  trace,
  type Attributes,
  type SpanOptions,
  type Tracer,
} from "@opentelemetry/api";
import { describe, expect, it, vi } from "vitest";

import { withDbSpan } from "./db-span";

type RecordedSpan = {
  name: string;
  options: SpanOptions;
  attributes: Attributes;
  status?: { code: SpanStatusCode };
  ended: boolean;
};

function installFakeTracer(): RecordedSpan[] {
  const spans: RecordedSpan[] = [];
  const tracer = {
    startActiveSpan(name: string, options: SpanOptions, fn: unknown) {
      const recorded: RecordedSpan = {
        name,
        options,
        attributes: { ...options.attributes },
        ended: false,
      };
      spans.push(recorded);
      const span = {
        setAttribute(key: string, value: string) {
          recorded.attributes[key] = value;
        },
        setStatus(status: { code: SpanStatusCode }) {
          recorded.status = status;
        },
        end() {
          recorded.ended = true;
        },
      };

      return (fn as (span: unknown) => unknown)(span);
    },
  } as unknown as Tracer;

  vi.spyOn(trace, "getTracer").mockReturnValue(tracer);

  return spans;
}

describe("withDbSpan", () => {
  it("deve abrir um span CLIENT com tabela e operação e devolver o resultado", async () => {
    const spans = installFakeTracer();
    const result = { data: { id: "1" }, error: null };

    const returned = await withDbSpan(
      { table: "users", operation: "SELECT" },
      Promise.resolve(result),
    );

    expect(returned).toBe(result);
    expect(spans).toHaveLength(1);
    expect(spans[0]?.name).toBe("SELECT users");
    expect(spans[0]?.options.kind).toBe(SpanKind.CLIENT);
    expect(spans[0]?.attributes).toEqual({
      "db.system": "postgresql",
      "db.system.name": "postgresql",
      "db.collection.name": "users",
      "db.operation.name": "SELECT",
    });
    expect(spans[0]?.status).toBeUndefined();
    expect(spans[0]?.ended).toBe(true);
  });

  it("deve marcar o span como erro quando o resultado traz error, sem registrar a mensagem", async () => {
    const spans = installFakeTracer();
    const result = {
      data: null,
      error: { code: "23505", message: "duplicate key ada@example.com" },
    };

    const returned = await withDbSpan(
      { table: "users", operation: "INSERT" },
      Promise.resolve(result),
    );

    expect(returned).toBe(result);
    expect(spans[0]?.status).toEqual({ code: SpanStatusCode.ERROR });
    expect(spans[0]?.attributes["db.response.status_code"]).toBe("23505");
    expect(spans[0]?.attributes["error.type"]).toBe("23505");
    expect(JSON.stringify(spans[0])).not.toContain("ada@example.com");
    expect(spans[0]?.ended).toBe(true);
  });

  it("deve usar o código 'unknown' quando o erro não tem código", async () => {
    const spans = installFakeTracer();

    await withDbSpan(
      { table: "sessions", operation: "UPDATE" },
      Promise.resolve({ data: null, error: {} }),
    );

    expect(spans[0]?.attributes["db.response.status_code"]).toBe("unknown");
  });

  it("deve marcar erro, repassar a exceção e encerrar o span quando a query lança", async () => {
    const spans = installFakeTracer();

    await expect(
      withDbSpan(
        { table: "auth_tokens", operation: "SELECT" },
        Promise.reject(new TypeError("fetch failed")),
      ),
    ).rejects.toThrow("fetch failed");

    expect(spans[0]?.status).toEqual({ code: SpanStatusCode.ERROR });
    expect(spans[0]?.attributes["error.type"]).toBe("TypeError");
    expect(spans[0]?.ended).toBe(true);
  });
});
