import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TraceSinkPort } from "./ports/trace-sink.port";
import { TraceEmitter } from "./trace-emitter";
import { InMemoryTraceSink } from "../../../test/fakes/in-memory-trace-sink";
import { pseudonymizeUserId } from "../domain/user-pseudonym";

const salt = "test-emitter-salt";

function emission() {
  return {
    id: "span-1",
    traceId: "trace-1",
    name: "expert.chat",
    kind: "chat" as const,
    startedAt: Date.parse("2026-11-18T12:00:00.000Z"),
    endedAt: Date.parse("2026-11-18T12:00:00.050Z"),
    status: "ok" as const,
    userId: "user-42",
    conversationId: "conversation-1",
    messageId: "message-1",
    expertId: "cto",
    modelId: "gpt-4o-mini",
    metadata: {
      note: "person@example.test sessionToken=abcdefgh123456",
      password: "synthetic-secret",
    },
  };
}

describe("TraceEmitter", () => {
  let warnings: string[];

  beforeEach(() => {
    warnings = [];
    vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
      warnings.push(args.map((arg) => String(arg)).join(" "));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("não emite spans quando a flag está desligada", () => {
    const sink = new InMemoryTraceSink();
    const emitter = new TraceEmitter(sink, false, salt);

    emitter.emit(emission());

    expect(sink.spans).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it("pseudonimiza, sanitiza e remove chaves proibidas antes de emitir", () => {
    const sink = new InMemoryTraceSink();
    const emitter = new TraceEmitter(sink, true, salt);

    emitter.emit(emission());

    expect(sink.spans).toHaveLength(1);
    const span = sink.spans[0];

    expect(span?.userPseudonym).toBe(pseudonymizeUserId("user-42", salt));
    expect(span?.userPseudonym).not.toContain("user-42");
    expect(span?.metadata).toEqual({
      note: "[EMAIL] [TOKEN]",
    });
    expect(span?.events).toContain("obs.pii.sanitized");
    expect(span?.latencyMs).toBe(50);
    expect(span?.missingMetadata).toEqual([]);
  });

  it("marca metadados obrigatórios ausentes sem lançar", () => {
    const sink = new InMemoryTraceSink();
    const emitter = new TraceEmitter(sink, true, salt);

    emitter.emit({ ...emission(), expertId: null, messageId: "  " });

    expect(sink.spans[0]?.missingMetadata).toEqual(["messageId", "expertId"]);
    expect(
      warnings.some((line) => line.includes("obs.trace.missing_metadata")),
    ).toBe(true);
  });

  it("registra obs.trace.dropped quando o sink falha", async () => {
    class FailingSink extends TraceSinkPort {
      override async send(): Promise<void> {
        throw new Error("collector offline");
      }
    }
    const emitter = new TraceEmitter(new FailingSink(), true, salt);

    emitter.emit(emission());
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(warnings.some((line) => line.includes("obs.trace.dropped"))).toBe(
      true,
    );
    expect(warnings.some((line) => line.includes("collector offline"))).toBe(
      false,
    );
  });
});
