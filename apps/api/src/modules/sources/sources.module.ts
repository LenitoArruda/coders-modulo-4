import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { memoryStorage } from "multer";

import { AuthModule } from "../auth/auth.module";
import { loadEnv } from "../shared/config/env";

import {
  MAX_FILES_PER_UPLOAD,
  MAX_UPLOAD_FILE_BYTES,
} from "./domain/source-file-policy";
import {
  SOURCE_EMBEDDING_DIMENSIONS,
  SOURCE_MEDIA_ENABLED,
  SOURCE_OPENAI_API_KEY,
  SOURCE_WEAVIATE_URL,
} from "./sources.tokens";
import { ConnectSourcesUseCase } from "./application/connect-sources.use-case";
import { DeleteSourceUseCase } from "./application/delete-source.use-case";
import { ListSourcesUseCase } from "./application/list-sources.use-case";
import { SourcesRepositoryPort } from "./application/ports/sources-repository.port";
import { DocumentTextExtractorPort } from "./application/ports/document-text-extractor.port";
import { MediaTextExtractorPort } from "./application/ports/media-text-extractor.port";
import { EmbeddingGeneratorPort } from "./application/ports/embedding-generator.port";
import { VectorStorePort } from "./application/ports/vector-store.port";
import { ProcessSourceVersionUseCase } from "./application/process-source-version.use-case";
import { RetrySourceVersionUseCase } from "./application/retry-source-version.use-case";
import { DocumentTextExtractorAdapter } from "./infrastructure/document-text-extractor.adapter";
import { LocalMediaTextExtractorAdapter } from "./infrastructure/local-media-text-extractor.adapter";
import { OpenAIEmbeddingGeneratorAdapter } from "./infrastructure/openai-embedding-generator.adapter";
import { PostgresSourcesRepository } from "./infrastructure/postgres-sources.repository";
import { WeaviateRestVectorStoreAdapter } from "./infrastructure/weaviate-rest-vector-store.adapter";
import { ConnectSourcesRequestHandler } from "./interface/request-handlers/connect-sources.request-handler";
import { DeleteSourceRequestHandler } from "./interface/request-handlers/delete-source.request-handler";
import { ListSourcesRequestHandler } from "./interface/request-handlers/list-sources.request-handler";
import { RetrySourceVersionRequestHandler } from "./interface/request-handlers/retry-source-version.request-handler";

const DEFAULT_WEAVIATE_URL = "http://127.0.0.1:8080";
const DEFAULT_EMBEDDING_DIMENSIONS = 1536;

@Module({
  imports: [
    AuthModule,
    MulterModule.register({
      storage: memoryStorage(),
      limits: {
        fileSize: MAX_UPLOAD_FILE_BYTES,
        files: MAX_FILES_PER_UPLOAD,
      },
    }),
  ],
  controllers: [
    ConnectSourcesRequestHandler,
    ListSourcesRequestHandler,
    DeleteSourceRequestHandler,
    RetrySourceVersionRequestHandler,
  ],
  providers: [
    {
      provide: SOURCE_WEAVIATE_URL,
      useFactory: () =>
        process.env.WEAVIATE_URL?.trim() || DEFAULT_WEAVIATE_URL,
    },
    {
      provide: SOURCE_EMBEDDING_DIMENSIONS,
      useFactory: () => {
        const value = Number(process.env.EMBEDDING_DIMENSIONS?.trim());

        return Number.isInteger(value) && value > 0
          ? value
          : DEFAULT_EMBEDDING_DIMENSIONS;
      },
    },
    {
      provide: SOURCE_OPENAI_API_KEY,
      useFactory: () => loadEnv().openaiApiKey,
    },
    {
      provide: SOURCE_MEDIA_ENABLED,
      useFactory: () =>
        ["1", "true"].includes(
          process.env.KNOWLEDGE_MEDIA_ENABLED?.trim().toLowerCase() ?? "",
        ),
    },
    { provide: SourcesRepositoryPort, useClass: PostgresSourcesRepository },
    {
      provide: DocumentTextExtractorPort,
      useClass: DocumentTextExtractorAdapter,
    },
    {
      provide: MediaTextExtractorPort,
      useClass: LocalMediaTextExtractorAdapter,
    },
    {
      provide: EmbeddingGeneratorPort,
      useClass: OpenAIEmbeddingGeneratorAdapter,
    },
    { provide: VectorStorePort, useClass: WeaviateRestVectorStoreAdapter },
    ConnectSourcesUseCase,
    ListSourcesUseCase,
    DeleteSourceUseCase,
    RetrySourceVersionUseCase,
    ProcessSourceVersionUseCase,
  ],
})
export class SourcesModule {}
