import { beforeEach, describe, expect, it } from "vitest";

import { ComposeCitedAnswerUseCase } from "../../citations/application/compose-cited-answer.use-case";
import { CitationSourceMetadataPort } from "../../citations/application/ports/citation-source-metadata.port";
import { KnowledgeRetrievalPort } from "../../citations/application/ports/knowledge-retrieval.port";
import { QueryEmbeddingPort } from "../../citations/application/ports/query-embedding.port";
import type { VectorHit } from "../../citations/application/ports/knowledge-retrieval.port";
import { RetrieveContextUseCase } from "../../citations/application/retrieve-context.use-case";
import { InMemoryConversationsRepository } from "../../../test/fakes/in-memory-conversations.repository";
import { FakeExpertResponder } from "../../../test/fakes/fake-expert-responder";
import { InMemoryTraceSink } from "../../../test/fakes/in-memory-trace-sink";
import { SendMessageUseCase } from "../../conversations/application/send-message.use-case";
import { ModelUnavailableError } from "../../conversations/domain/conversation.errors";
import { TraceEmitter } from "../application/trace-emitter";
import { TraceSinkPort } from "../application/ports/trace-sink.port";
import { pseudonymizeUserId } from "../domain/user-pseudonym";

const USER = "11111111-1111-1111-1111-111111111111";
const SALT = "test-integration-salt";

class FakeEmbeddings extends QueryEmbeddingPort {
  override async embedQuery(): Promise<number[]> {
    return [0.1, 0.2];
  }
}

class FakeRetrieval extends KnowledgeRetrievalPort {
  readonly hits: VectorHit[] = [
    {
      chunkId: "chunk-1",
      sourceId: "source-1",
      sourceVersionId: "version-1",
      chunkIndex: 0,
      content: "Ship in small batches.",
      score: 0.9,
    },
  ];

  override async search(userId: string): Promise<VectorHit[]> {
    return userId === USER ? this.hits : [];
  }
}

class FakeSources extends CitationSourceMetadataPort {
  override async load() {
    return new Map([
      [
        "version-1",
        {
          sourceName: "handbook.txt",
          sourceType: "txt",
          isStale: false,
          sourceRemoved: false,
        },
      ],
    ]);
  }
}

class FailingSink extends TraceSinkPort {
  override async send(): Promise<void> {
    throw new Error("collector offline");
  }
}

describe("instrumentação ponta a ponta (spec 018)", () => {
  let conversations: InMemoryConversationsRepository;
  let responder: FakeExpertResponder;
  let sink: InMemoryTraceSink;
  let sendMessage: SendMessageUseCase;

  beforeEach(() => {
    conversations = new InMemoryConversationsRepository();
    responder = new FakeExpertResponder();
    sink = new InMemoryTraceSink();
    const emitter = new TraceEmitter(sink, true, SALT);
    const retrieve = new RetrieveContextUseCase(
      new FakeEmbeddings(),
      new FakeRetrieval(),
      new FakeSources(),
      emitter,
    );

    sendMessage = new SendMessageUseCase(
      conversations,
      responder,
      true,
      retrieve,
      new ComposeCitedAnswerUseCase(),
      5,
      0.35,
      6_000,
      6,
      emitter,
    );
  });

  it("emite root e recuperação correlacionados, sem PII", async () => {
    const result = await sendMessage.execute({
      userId: USER,
      expertId: "cto",
      prompt: "person@example.test How should we ship?",
      source: "typed",
    });

    const byKind = Object.fromEntries(
      sink.spans.map((span) => [span.kind, span]),
    );
    const root = byKind.chat;
    const retrieval = byKind.retrieval;

    expect(sink.spans.map((span) => span.kind)).toEqual(["retrieval", "chat"]);
    expect(root?.traceId).toBe(retrieval?.traceId);
    expect(root?.parentSpanId).toBeNull();
    expect(retrieval?.parentSpanId).toBe(root?.id);
    expect(root).toMatchObject({
      conversationId: result.conversationId,
      messageId: result.expertMessage.id,
      expertId: "cto",
      modelId: "gpt-4o-mini",
      status: "ok",
      metadata: { answerStatus: "with_source", citationCount: 1 },
    });
    expect(retrieval?.metadata).toMatchObject({
      topK: 5,
      threshold: 0.35,
      scores: [0.9],
      sourceIds: ["source-1"],
      chunksConsidered: 1,
    });
    expect(responder.calls[0]?.trace?.traceId).toBe(root?.traceId);
    expect(root?.userPseudonym).toBe(pseudonymizeUserId(USER, SALT));
    expect(JSON.stringify(sink.spans)).not.toContain("person@example.test");
    expect(JSON.stringify(sink.spans)).not.toContain(USER);
  });

  it("mantém o chat funcional quando o coletor falha", async () => {
    const failingEmitter = new TraceEmitter(new FailingSink(), true, SALT);
    const failingUseCase = new SendMessageUseCase(
      conversations,
      responder,
      false,
      null,
      null,
      5,
      0.35,
      6_000,
      6,
      failingEmitter,
    );

    const result = await failingUseCase.execute({
      userId: USER,
      expertId: "cto",
      prompt: "Question",
      source: "typed",
    });

    expect(result.expertMessage.content).toContain("focused answer");
    expect(conversations.messages).toHaveLength(2);
  });

  it("registra span de erro quando o modelo falha", async () => {
    responder.failWith = new Error("synthetic model failure");

    await expect(
      sendMessage.execute({
        userId: USER,
        expertId: "cfo",
        prompt: "Question",
        source: "typed",
      }),
    ).rejects.toBeInstanceOf(ModelUnavailableError);

    expect(sink.spans.map((span) => span.status)).toEqual(["ok", "error"]);
    expect(sink.spans[1]?.metadata).toMatchObject({ error: "Error" });
    expect(conversations.messages).toHaveLength(0);
  });
});
