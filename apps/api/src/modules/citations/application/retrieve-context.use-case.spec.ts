import { beforeEach, describe, expect, it } from "vitest";

import { QueryEmbeddingPort } from "../application/ports/query-embedding.port";
import {
  KnowledgeRetrievalPort,
  type VectorHit,
} from "../application/ports/knowledge-retrieval.port";
import { CitationSourceMetadataPort } from "../application/ports/citation-source-metadata.port";
import { KnowledgeRetrievalError } from "../domain/citation.errors";

import { RetrieveContextUseCase } from "./retrieve-context.use-case";

class FakeEmbeddings extends QueryEmbeddingPort {
  fail = false;

  async embedQuery(): Promise<number[]> {
    if (this.fail) throw new Error("no key");

    return [0.1, 0.2, 0.3];
  }
}

class FakeRetrieval extends KnowledgeRetrievalPort {
  hits: VectorHit[] = [];
  seenUserId: string | null = null;

  async search(userId: string): Promise<VectorHit[]> {
    this.seenUserId = userId;

    return this.hits;
  }
}

class FakeSources extends CitationSourceMetadataPort {
  async load() {
    return new Map([
      [
        "version-1",
        {
          sourceName: "guide.txt",
          sourceType: "txt",
          isStale: true,
          sourceRemoved: false,
        },
      ],
    ]);
  }
}

describe("RetrieveContextUseCase", () => {
  let embeddings: FakeEmbeddings;
  let retrieval: FakeRetrieval;
  let useCase: RetrieveContextUseCase;

  beforeEach(() => {
    embeddings = new FakeEmbeddings();
    retrieval = new FakeRetrieval();
    useCase = new RetrieveContextUseCase(
      embeddings,
      retrieval,
      new FakeSources(),
    );
  });

  const input = {
    userId: "user-a",
    prompt: "What is in the guide?",
    topK: 5,
    threshold: 0.35,
    maxContextChars: 6_000,
  };

  it("filtra por usuário, limiar e enriquece o trecho recuperado", async () => {
    retrieval.hits = [
      {
        chunkId: "chunk-1",
        sourceId: "source-1",
        sourceVersionId: "version-1",
        chunkIndex: 0,
        content: "The guide says to ship small batches.",
        score: 0.8,
      },
      {
        chunkId: "chunk-2",
        sourceId: "source-1",
        sourceVersionId: "version-1",
        chunkIndex: 1,
        content: "Low score content.",
        score: 0.1,
      },
    ];

    const context = await useCase.execute(input);

    expect(retrieval.seenUserId).toBe("user-a");
    expect(context.status).toBe("matched");
    expect(context.snippets).toHaveLength(1);
    expect(context.snippets[0]?.citation.sourceName).toBe("guide.txt");
    expect(context.snippets[0]?.citation.isStale).toBe(true);
    expect(context.metadata.chunksConsidered).toBe(2);
  });

  it("degrada para unavailable sem inventar contexto", async () => {
    embeddings.fail = true;

    const context = await useCase.execute(input);

    expect(context.status).toBe("unavailable");
    expect(context.snippets).toEqual([]);
    expect(context.notice).toContain("Knowledge search is unavailable");
  });

  it("degrada quando a busca vetorial falha", async () => {
    class FailingRetrieval extends KnowledgeRetrievalPort {
      async search(): Promise<never> {
        throw new KnowledgeRetrievalError();
      }
    }

    const failing = new RetrieveContextUseCase(
      embeddings,
      new FailingRetrieval(),
      new FakeSources(),
    );

    expect((await failing.execute(input)).status).toBe("unavailable");
  });
});
