import { Module } from "@nestjs/common";

import { loadEnv } from "../shared/config/env";

import { TraceEmitter } from "./application/trace-emitter";
import { TraceSinkPort } from "./application/ports/trace-sink.port";
import { createTraceSink } from "./infrastructure/create-trace-sink";
import {
  OBS_API_KEY,
  OBS_ENDPOINT,
  OBS_TRACE_BATCH_SIZE,
  OBS_TRACE_FLUSH_INTERVAL_MS,
  OBS_TRACING_ENABLED,
  OBS_USER_PSEUDONYM_SALT,
} from "./observability.tokens";

/** Flag-gated observability slice. It exposes no public HTTP endpoints. */
@Module({
  providers: [
    {
      provide: OBS_TRACING_ENABLED,
      useFactory: () => loadEnv().obsTracingEnabled,
    },
    { provide: OBS_ENDPOINT, useFactory: () => loadEnv().obsEndpoint },
    { provide: OBS_API_KEY, useFactory: () => loadEnv().obsApiKey },
    {
      provide: OBS_USER_PSEUDONYM_SALT,
      useFactory: () => loadEnv().obsUserPseudonymSalt,
    },
    {
      provide: OBS_TRACE_BATCH_SIZE,
      useFactory: () => loadEnv().obsTraceBatchSize,
    },
    {
      provide: OBS_TRACE_FLUSH_INTERVAL_MS,
      useFactory: () => loadEnv().obsTraceFlushIntervalMs,
    },
    {
      provide: TraceSinkPort,
      useFactory: createTraceSink,
      inject: [
        OBS_TRACING_ENABLED,
        OBS_ENDPOINT,
        OBS_API_KEY,
        OBS_TRACE_BATCH_SIZE,
        OBS_TRACE_FLUSH_INTERVAL_MS,
      ],
    },
    TraceEmitter,
  ],
  exports: [TraceEmitter],
})
export class ObservabilityModule {}
