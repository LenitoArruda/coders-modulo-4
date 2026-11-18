import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getExpertById } from "../../experts/domain/expert-catalog";
import { TraceEmitter } from "../../observability/application/trace-emitter";
import type { TraceCorrelation } from "../../observability/domain/trace-span";
import { InMemoryTraceSink } from "../../../test/fakes/in-memory-trace-sink";
import { ModelUnavailableError } from "../domain/conversation.errors";

import { LangGraphExpertResponder } from "./langgraph-expert.responder";

type FakeModelState = { fail: boolean };
const FAKE_MODEL_STATE_KEY = "__OBS_FAKE_MODEL_STATE__";

function fakeModelState(): FakeModelState {
  const global = globalThis as Record<string, unknown>;

  if (global[FAKE_MODEL_STATE_KEY] === undefined) {
    global[FAKE_MODEL_STATE_KEY] = { fail: false };
  }

  return global[FAKE_MODEL_STATE_KEY] as FakeModelState;
}

vi.mock("@langchain/openai", async () => {
  const { AIMessage } = await import("@langchain/core/messages");

  class FakeChatOpenAI {
    async invoke() {
      const global = globalThis as Record<string, unknown>;
      const state = global["__OBS_FAKE_MODEL_STATE__"] as
        FakeModelState | undefined;

      if (state?.fail === true) throw new Error("synthetic model failure");

      return new AIMessage({
        content: "Generated answer",
        usage_metadata: {
          input_tokens: 12,
          output_tokens: 8,
          total_tokens: 20,
        },
        response_metadata: { finish_reason: "stop" },
      });
    }
  }

  return { ChatOpenAI: FakeChatOpenAI };
});

describe("LangGraphExpertResponder observability", () => {
  const trace: TraceCorrelation = {
    traceId: "trace-1",
    parentSpanId: "root-span-1",
    userId: "user-42",
    expertId: "cto",
    conversationId: "conversation-1",
    messageId: "message-1",
  };

  let sink: InMemoryTraceSink;

  beforeEach(() => {
    fakeModelState().fail = false;
    sink = new InMemoryTraceSink();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emite span de geração com tokens, custo e correlação", async () => {
    const responder = new LangGraphExpertResponder(
      "test-model-key",
      new TraceEmitter(sink, true, "test-salt"),
    );
    const expert = getExpertById("cto");

    expect(expert).not.toBeNull();
    await expect(
      responder.respond(expert!, "Question", null, [], trace),
    ).resolves.toBe("Generated answer");

    expect(sink.spans).toHaveLength(1);
    expect(sink.spans[0]).toMatchObject({
      name: "expert.generation",
      kind: "generation",
      traceId: "trace-1",
      parentSpanId: "root-span-1",
      conversationId: "conversation-1",
      messageId: "message-1",
      expertId: "cto",
      modelId: "gpt-4o-mini",
      status: "ok",
      metadata: {
        promptVersion: "expert-chat-v1",
        tokensIn: 12,
        tokensOut: 8,
        estimatedCostUsd: 0.000007,
        finishReason: "stop",
        costRateKnown: true,
      },
    });
  });

  it("emite span de erro sem quebrar o contrato de falha do modelo", async () => {
    fakeModelState().fail = true;
    const responder = new LangGraphExpertResponder(
      "test-model-key",
      new TraceEmitter(sink, true, "test-salt"),
    );
    const expert = getExpertById("cto");

    await expect(
      responder.respond(expert!, "Question", null, [], trace),
    ).rejects.toBeInstanceOf(ModelUnavailableError);

    expect(sink.spans[0]).toMatchObject({
      kind: "generation",
      status: "error",
      metadata: { error: "Error" },
    });
  });
});
