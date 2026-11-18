import { Module } from "@nestjs/common";

import { loadEnv } from "../shared/config/env";

import {
  CITATION_EMBEDDING_DIMENSIONS,
  CITATION_QUERY_EMBEDDING_API_KEY,
  CITATION_WEAVIATE_URL,
  RAG_CITATIONS_ENABLED,
  RAG_MAX_CONTEXT_CHARS,
  RAG_MAX_HISTORY_MESSAGES,
  RAG_THRESHOLD,
  RAG_TOP_K,
} from "./citations.tokens";
import { ComposeCitedAnswerUseCase } from "./application/compose-cited-answer.use-case";
import { RefreshCitationsUseCase } from "./application/refresh-citations.use-case";
import { RetrieveContextUseCase } from "./application/retrieve-context.use-case";
import { CitationSourceMetadataPort } from "./application/ports/citation-source-metadata.port";
import { KnowledgeRetrievalPort } from "./application/ports/knowledge-retrieval.port";
import { QueryEmbeddingPort } from "./application/ports/query-embedding.port";
import { OpenAiQueryEmbeddingAdapter } from "./infrastructure/openai-query-embedding.adapter";
import { PostgresCitationSourceMetadataAdapter } from "./infrastructure/postgres-citation-source-metadata.adapter";
import { WeaviateRetrievalAdapter } from "./infrastructure/weaviate-retrieval.adapter";

const DEFAULT_WEAVIATE_URL = "http://127.0.0.1:8080";
const DEFAULT_EMBEDDING_DIMENSIONS = 1536;

/** Retrieval slice. It has no endpoints; the conversations slice consumes it. */
@Module({
  providers: [
    {
      provide: CITATION_WEAVIATE_URL,
      useFactory: () =>
        process.env.WEAVIATE_URL?.trim() || DEFAULT_WEAVIATE_URL,
    },
    {
      provide: CITATION_EMBEDDING_DIMENSIONS,
      useFactory: () => {
        const value = Number(process.env.EMBEDDING_DIMENSIONS?.trim());

        return Number.isInteger(value) && value > 0
          ? value
          : DEFAULT_EMBEDDING_DIMENSIONS;
      },
    },
    {
      provide: CITATION_QUERY_EMBEDDING_API_KEY,
      useFactory: () => loadEnv().openaiApiKey,
    },
    {
      provide: RAG_CITATIONS_ENABLED,
      useFactory: () => loadEnv().ragCitationsEnabled,
    },
    {
      provide: RAG_TOP_K,
      useFactory: () => loadEnv().ragTopK,
    },
    {
      provide: RAG_THRESHOLD,
      useFactory: () => loadEnv().ragThreshold,
    },
    {
      provide: RAG_MAX_CONTEXT_CHARS,
      useFactory: () => loadEnv().ragMaxContextChars,
    },
    {
      provide: RAG_MAX_HISTORY_MESSAGES,
      useFactory: () => loadEnv().ragMaxHistoryMessages,
    },
    { provide: QueryEmbeddingPort, useClass: OpenAiQueryEmbeddingAdapter },
    { provide: KnowledgeRetrievalPort, useClass: WeaviateRetrievalAdapter },
    {
      provide: CitationSourceMetadataPort,
      useClass: PostgresCitationSourceMetadataAdapter,
    },
    RetrieveContextUseCase,
    ComposeCitedAnswerUseCase,
    RefreshCitationsUseCase,
  ],
  exports: [
    RAG_CITATIONS_ENABLED,
    RAG_TOP_K,
    RAG_THRESHOLD,
    RAG_MAX_CONTEXT_CHARS,
    RAG_MAX_HISTORY_MESSAGES,
    RetrieveContextUseCase,
    ComposeCitedAnswerUseCase,
    RefreshCitationsUseCase,
  ],
})
export class CitationsModule {}
