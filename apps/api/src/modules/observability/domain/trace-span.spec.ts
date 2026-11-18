import { describe, expect, it } from "vitest";

import {
  createTraceSpan,
  MISSING_METADATA_MARKER,
  REQUIRED_TRACE_METADATA,
  TRACE_SCHEMA_VERSION,
} from "./trace-span";

describe("createTraceSpan", () => {
  const baseInput = {
    id: "span-1",
    traceId: "trace-1",
    name: "expert.chat",
    kind: "chat" as const,
    startedAt: Date.parse("2026-11-18T12:00:00.000Z"),
    endedAt: Date.parse("2026-11-18T12:00:00.125Z"),
    status: "ok" as const,
    conversationId: "conversation-1",
    messageId: "message-1",
    expertId: "cto",
    userPseudonym: "u_hash",
    modelId: "gpt-4o-mini",
  };

  it("cria um span versionado com todos os metadados obrigatórios", () => {
    const span = createTraceSpan(baseInput);

    expect(span).toMatchObject({
      schemaVersion: TRACE_SCHEMA_VERSION,
      traceId: "trace-1",
      conversationId: "conversation-1",
      messageId: "message-1",
      expertId: "cto",
      userPseudonym: "u_hash",
      modelId: "gpt-4o-mini",
      status: "ok",
      latencyMs: 125,
      timestamp: "2026-11-18T12:00:00.000Z",
      parentSpanId: null,
      metadata: {},
      events: [],
      missingMetadata: [],
    });
  });

  it("marca campos ausentes em vez de falhar", () => {
    const span = createTraceSpan({
      ...baseInput,
      conversationId: null,
      messageId: "   ",
      expertId: undefined,
      userPseudonym: "",
      modelId: null,
      metadata: { topK: 5 },
      events: ["obs.pii.sanitized"],
    });

    expect(span.conversationId).toBe(MISSING_METADATA_MARKER);
    expect(span.messageId).toBe(MISSING_METADATA_MARKER);
    expect(span.expertId).toBe(MISSING_METADATA_MARKER);
    expect(span.userPseudonym).toBe(MISSING_METADATA_MARKER);
    expect(span.modelId).toBe(MISSING_METADATA_MARKER);
    expect(span.missingMetadata).toEqual([
      "conversationId",
      "messageId",
      "expertId",
      "userPseudonym",
      "modelId",
    ]);
    expect(span.metadata).toEqual({ topK: 5 });
    expect(span.events).toEqual(["obs.pii.sanitized"]);
  });

  it("mantém o traceId obrigatório marcado quando ausente", () => {
    const span = createTraceSpan({ ...baseInput, traceId: "" });

    expect(span.traceId).toBe(MISSING_METADATA_MARKER);
    expect(span.missingMetadata).toContain("traceId");
  });

  it("usa zero como latência quando o span não terminou", () => {
    const span = createTraceSpan({ ...baseInput, endedAt: undefined });

    expect(span.latencyMs).toBe(0);
  });

  it("nunca produz latência negativa", () => {
    const span = createTraceSpan({
      ...baseInput,
      endedAt: baseInput.startedAt - 10,
    });

    expect(span.latencyMs).toBe(0);
  });

  it("expõe a lista completa de metadados obrigatórios do contrato", () => {
    expect(REQUIRED_TRACE_METADATA).toEqual([
      "traceId",
      "conversationId",
      "messageId",
      "expertId",
      "userPseudonym",
      "modelId",
      "timestamp",
      "status",
      "latencyMs",
    ]);
  });
});
