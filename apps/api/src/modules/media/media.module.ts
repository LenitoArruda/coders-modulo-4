import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { loadEnv } from "../shared/config/env";

import {
  MEDIA_ENABLED,
  MEDIA_GEMINI_API_BASE_URL,
  MEDIA_GEMINI_API_KEY,
  MEDIA_IMAGE_MODEL_ID,
  MEDIA_IMAGE_QUOTA_PER_HOUR,
  MEDIA_MAX_FILE_BYTES,
  MEDIA_OPENAI_API_BASE_URL,
  MEDIA_OPENAI_API_KEY,
  MEDIA_QUOTA_WINDOW_SECONDS,
  MEDIA_VIDEO_MODEL_ID,
  MEDIA_VIDEO_QUOTA_PER_HOUR,
} from "./media.tokens";
import { CancelMediaGenerationUseCase } from "./application/cancel-media-generation.use-case";
import { DownloadMediaUseCase } from "./application/download-media.use-case";
import { GetMediaStatusUseCase } from "./application/get-media-status.use-case";
import { MediaGenerationRepositoryPort } from "./application/ports/media-generation-repository.port";
import { MediaGeneratorPort } from "./application/ports/media-generator.port";
import { MediaJobQueuePort } from "./application/ports/media-job-queue.port";
import { MediaQuotaPort } from "./application/ports/media-quota.port";
import { ProcessMediaGenerationUseCase } from "./application/process-media-generation.use-case";
import { RequestMediaGenerationUseCase } from "./application/request-media-generation.use-case";
import { RetryMediaGenerationUseCase } from "./application/retry-media-generation.use-case";
import { GeminiVideoGenerator } from "./infrastructure/gemini-video.generator";
import { InMemoryMediaJobQueue } from "./infrastructure/in-memory-media-job-queue";
import { InMemoryMediaQuota } from "./infrastructure/in-memory-media-quota";
import { MediaGeneratorRouter } from "./infrastructure/media-generator.router";
import { OpenAIImageGenerator } from "./infrastructure/openai-image.generator";
import { PostgresMediaRepository } from "./infrastructure/postgres-media.repository";
import { CancelMediaGenerationRequestHandler } from "./interface/request-handlers/cancel-media-generation.request-handler";
import { MediaFlagGuard } from "./interface/media-flag.guard";
import { DownloadMediaRequestHandler } from "./interface/request-handlers/download-media.request-handler";
import { GetMediaStatusRequestHandler } from "./interface/request-handlers/get-media-status.request-handler";
import { RetryMediaGenerationRequestHandler } from "./interface/request-handlers/retry-media-generation.request-handler";

/**
 * Optional multimedia deliverables slice (spec 017). Configuration is read
 * lazily so importing the module never requires provider keys to be present.
 */
@Module({
  imports: [AuthModule],
  controllers: [
    GetMediaStatusRequestHandler,
    CancelMediaGenerationRequestHandler,
    RetryMediaGenerationRequestHandler,
    DownloadMediaRequestHandler,
  ],
  providers: [
    MediaFlagGuard,
    {
      provide: MEDIA_ENABLED,
      useFactory: () => loadEnv().multimediaDeliverablesEnabled,
    },
    {
      provide: MEDIA_IMAGE_MODEL_ID,
      useFactory: () => loadEnv().mediaImageModelId,
    },
    {
      provide: MEDIA_VIDEO_MODEL_ID,
      useFactory: () => loadEnv().mediaVideoModelId,
    },
    {
      provide: MEDIA_IMAGE_QUOTA_PER_HOUR,
      useFactory: () => loadEnv().mediaImageQuotaPerHour,
    },
    {
      provide: MEDIA_VIDEO_QUOTA_PER_HOUR,
      useFactory: () => loadEnv().mediaVideoQuotaPerHour,
    },
    {
      provide: MEDIA_QUOTA_WINDOW_SECONDS,
      useFactory: () => loadEnv().mediaQuotaWindowSeconds,
    },
    {
      provide: MEDIA_MAX_FILE_BYTES,
      useFactory: () => loadEnv().mediaMaxFileBytes,
    },
    { provide: MEDIA_OPENAI_API_KEY, useFactory: () => loadEnv().openaiApiKey },
    {
      provide: MEDIA_OPENAI_API_BASE_URL,
      useFactory: () => loadEnv().openaiApiBaseUrl,
    },
    { provide: MEDIA_GEMINI_API_KEY, useFactory: () => loadEnv().geminiApiKey },
    {
      provide: MEDIA_GEMINI_API_BASE_URL,
      useFactory: () => loadEnv().geminiApiBaseUrl,
    },
    {
      provide: MediaGenerationRepositoryPort,
      useClass: PostgresMediaRepository,
    },
    { provide: MediaQuotaPort, useClass: InMemoryMediaQuota },
    OpenAIImageGenerator,
    GeminiVideoGenerator,
    { provide: MediaGeneratorPort, useClass: MediaGeneratorRouter },
    ProcessMediaGenerationUseCase,
    { provide: MediaJobQueuePort, useClass: InMemoryMediaJobQueue },
    RequestMediaGenerationUseCase,
    GetMediaStatusUseCase,
    CancelMediaGenerationUseCase,
    RetryMediaGenerationUseCase,
    DownloadMediaUseCase,
  ],
  exports: [
    MEDIA_ENABLED,
    MediaGenerationRepositoryPort,
    RequestMediaGenerationUseCase,
  ],
})
export class MediaModule {}
