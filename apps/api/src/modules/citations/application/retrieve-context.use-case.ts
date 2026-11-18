import { randomUUID } from "node:crypto";
import { Inject, Injectable, Optional } from "@nestjs/common";

import { TraceEmitter } from "../../observability/application/trace-emitter";
import { createRetrievalSpanMetadata } from "../../observability/domain/span-metadata";
import type { TraceCorrelation } from "../../observability/domain/trace-span";
import { log } from "../../shared/observability/app-logger";
import {
  QUERY_EMBEDDING_MODEL,
  VECTOR_INDEX,
  type GroundingContext,
  type RetrievedChunk,
  type RetrievalResult,
} from "../domain/citation";
import { buildGroundingContext, dedupeChunks } from "../domain/citation-policy";

import { CitationSourceMetadataPort } from "./ports/citation-source-metadata.port";
import { KnowledgeRetrievalPort } from "./ports/knowledge-retrieval.port";
import { QueryEmbeddingPort } from "./ports/query-embedding.port";

export type RetrieveContextInput = {
  userId: string;
  prompt: string;
  topK: number;
  threshold: number;
  maxContextChars: number;
  trace?: TraceCorrelation | null;
};

function unavailableResult(
  input: RetrieveContextInput,
  startedAt: number,
): RetrievalResult {
  return {
    status: "unavailable",
    chunks: [],
    metadata: {
      queryEmbeddingModel: QUERY_EMBEDDING_MODEL,
      vectorIndex: VECTOR_INDEX,
      topK: input.topK,
      threshold: input.threshold,
      scores: [],
      latencyMs: Date.now() - startedAt,
      chunksConsidered: 0,
      status: "unavailable",
    },
  };
}

/** Embeds the prompt, searches user-scoped vectors and builds prompt context. */
@Injectable()
export class RetrieveContextUseCase {
  constructor(
    private readonly embeddings: QueryEmbeddingPort,
    private readonly retrieval: KnowledgeRetrievalPort,
    private readonly sources: CitationSourceMetadataPort,
    @Optional()
    @Inject(TraceEmitter)
    private readonly traceEmitter: TraceEmitter | null = null,
  ) {}

  private emitTrace(
    input: RetrieveContextInput,
    result: RetrievalResult,
    startedAt: number,
  ): void {
    const status =
      result.metadata.status === "unavailable"
        ? "unavailable"
        : result.status === "no_match"
          ? "no_match"
          : "ok";

    this.traceEmitter?.emit({
      id: randomUUID(),
      traceId: input.trace?.traceId ?? randomUUID(),
      parentSpanId: input.trace?.parentSpanId ?? null,
      name: "expert.retrieval",
      kind: "retrieval",
      startedAt,
      endedAt: Date.now(),
      status,
      userId: input.userId,
      conversationId: input.trace?.conversationId,
      messageId: input.trace?.messageId,
      expertId: input.trace?.expertId,
      modelId: result.metadata.queryEmbeddingModel,
      metadata: createRetrievalSpanMetadata({
        topK: result.metadata.topK,
        threshold: result.metadata.threshold,
        scores: result.metadata.scores,
        sourceIds: [...new Set(result.chunks.map((chunk) => chunk.sourceId))],
        chunksConsidered: result.metadata.chunksConsidered,
        queryEmbeddingModel: result.metadata.queryEmbeddingModel,
        vectorIndex: result.metadata.vectorIndex,
      }),
    });
  }

  async execute(input: RetrieveContextInput): Promise<GroundingContext> {
    const startedAt = Date.now();

    log("info", "rag", {
      event: "rag.retrieval.started",
      userId: input.userId,
      topK: input.topK,
    });

    try {
      const vector = await this.embeddings.embedQuery(input.prompt);
      const hits = await this.retrieval.search(
        input.userId,
        vector,
        input.topK,
      );
      const candidates = hits.filter((hit) => hit.score >= input.threshold);
      const refs = candidates.map((hit) => ({
        sourceId: hit.sourceId,
        sourceVersionId: hit.sourceVersionId,
      }));
      const metadata = await this.sources.load(input.userId, refs);
      const chunks: RetrievedChunk[] = candidates.map((hit) => {
        const source = metadata.get(hit.sourceVersionId);

        return {
          chunkId: hit.chunkId,
          sourceId: hit.sourceId,
          sourceVersionId: hit.sourceVersionId,
          chunkIndex: hit.chunkIndex,
          content: hit.content,
          score: hit.score,
          sourceName: source?.sourceName ?? "Unknown source",
          sourceType: source?.sourceType ?? "unknown",
          isStale: source?.isStale ?? false,
          sourceRemoved: source?.sourceRemoved ?? false,
        };
      });
      const selected = dedupeChunks(chunks).slice(0, input.topK);
      const status = selected.length === 0 ? "no_match" : "matched";
      const result: RetrievalResult = {
        status,
        chunks: selected,
        metadata: {
          queryEmbeddingModel: QUERY_EMBEDDING_MODEL,
          vectorIndex: VECTOR_INDEX,
          topK: input.topK,
          threshold: input.threshold,
          scores: selected.map((chunk) => chunk.score),
          latencyMs: Date.now() - startedAt,
          chunksConsidered: hits.length,
          status,
        },
      };

      log("info", "rag", {
        event:
          status === "no_match"
            ? "rag.retrieval.no_match"
            : "rag.retrieval.completed",
        userId: input.userId,
        chunksConsidered: hits.length,
        chunksSelected: selected.length,
        durationMs: result.metadata.latencyMs,
        outcome: status,
      });
      this.emitTrace(input, result, startedAt);

      return buildGroundingContext(result, input.maxContextChars);
    } catch (error) {
      const result = unavailableResult(input, startedAt);

      log("warn", "rag", {
        event: "rag.retrieval.completed",
        userId: input.userId,
        durationMs: result.metadata.latencyMs,
        outcome: "unavailable",
        error: error instanceof Error ? error.name : "unknown",
      });
      this.emitTrace(input, result, startedAt);

      return buildGroundingContext(result, input.maxContextChars);
    }
  }
}
