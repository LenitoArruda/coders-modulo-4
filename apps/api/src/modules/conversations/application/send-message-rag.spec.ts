import { beforeEach, describe, expect, it } from "vitest";

import { QueryEmbeddingPort } from "../../citations/application/ports/query-embedding.port";
import { KnowledgeRetrievalPort } from "../../citations/application/ports/knowledge-retrieval.port";
import { CitationSourceMetadataPort } from "../../citations/application/ports/citation-source-metadata.port";
import { ComposeCitedAnswerUseCase } from "../../citations/application/compose-cited-answer.use-case";
import { RetrieveContextUseCase } from "../../citations/application/retrieve-context.use-case";
import type { VectorHit } from "../../citations/application/ports/knowledge-retrieval.port";
import { InMemoryConversationsRepository } from "../../../test/fakes/in-memory-conversations.repository";
import { FakeExpertResponder } from "../../../test/fakes/fake-expert-responder";

import { SendMessageUseCase } from "./send-message.use-case";

const USER = "11111111-1111-1111-1111-111111111111";

class FakeEmbeddings extends QueryEmbeddingPort {
  async embedQuery(): Promise<number[]> {
    return [0.1, 0.2];
  }
}

class FakeRetrieval extends KnowledgeRetrievalPort {
  hits: VectorHit[] = [
    {
      chunkId: "chunk-1",
      sourceId: "source-1",
      sourceVersionId: "version-1",
      chunkIndex: 0,
      content: "Ship in small batches.",
      score: 0.9,
    },
  ];

  async search(userId: string): Promise<VectorHit[]> {
    return userId === USER ? this.hits : [];
  }
}

class FakeSources extends CitationSourceMetadataPort {
  async load() {
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

describe("SendMessageUseCase with RAG", () => {
  let conversations: InMemoryConversationsRepository;
  let responder: FakeExpertResponder;
  let useCase: SendMessageUseCase;

  beforeEach(() => {
    conversations = new InMemoryConversationsRepository();
    responder = new FakeExpertResponder();
    const retrieve = new RetrieveContextUseCase(
      new FakeEmbeddings(),
      new FakeRetrieval(),
      new FakeSources(),
    );

    useCase = new SendMessageUseCase(
      conversations,
      responder,
      true,
      retrieve,
      new ComposeCitedAnswerUseCase(),
      5,
      0.35,
      6_000,
      6,
    );
  });

  it("persiste citações válidas e metadados de recuperação", async () => {
    const result = await useCase.execute({
      userId: USER,
      expertId: "cto",
      prompt: "How should we ship?",
      source: "typed",
    });

    expect(result.expertMessage.content).toContain("[1]");
    expect(result.expertMessage.citations).toHaveLength(1);
    expect(result.expertMessage.citations?.[0]?.sourceName).toBe(
      "handbook.txt",
    );
    expect(result.expertMessage.retrieval?.status).toBe("matched");
    expect(result.expertMessage.answerStatus).toBe("with_source");
    expect(responder.calls[0]?.grounding?.snippets).toHaveLength(1);
  });

  it("mantém o modo fatia 1 quando a flag está desligada", async () => {
    const plain = new SendMessageUseCase(conversations, responder, false);
    const result = await plain.execute({
      userId: USER,
      expertId: "cto",
      prompt: "Hello",
      source: "typed",
    });

    expect(result.expertMessage.citations).toBeUndefined();
    expect(result.expertMessage.answerStatus).toBeUndefined();
    expect(responder.calls[0]?.grounding).toBeNull();
  });
});
