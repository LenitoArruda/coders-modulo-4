import { Injectable, type OnApplicationShutdown } from "@nestjs/common";

import { log } from "../../shared/observability/app-logger";
import { stripForbiddenMetadata } from "../domain/metadata-policy";
import {
  TRACE_SCHEMA_VERSION,
  type TraceSpan,
  type TraceSpanKind,
} from "../domain/trace-span";
import { TraceSinkPort } from "../application/ports/trace-sink.port";

const DEFAULT_TIMEOUT_MS = 2_000;

const RUN_TYPES: Record<TraceSpanKind, string> = {
  chat: "chain",
  retrieval: "retriever",
  generation: "llm",
  media: "chain",
  source: "chain",
};

export type HttpTraceSinkOptions = {
  endpoint: string;
  apiKey: string;
  batchSize: number;
  flushIntervalMs: number;
  timeoutMs?: number;
};

/** Maps the internal contract to the LangSmith basic ingest run payload. */
export function toLangSmithRun(span: TraceSpan): Record<string, unknown> {
  const startTime = Date.parse(span.timestamp);
  const endTime = new Date(
    Number.isNaN(startTime) ? Date.now() : startTime + span.latencyMs,
  ).toISOString();
  const metadata = stripForbiddenMetadata({
    schemaVersion: span.schemaVersion,
    traceId: span.traceId,
    parentSpanId: span.parentSpanId,
    conversationId: span.conversationId,
    messageId: span.messageId,
    expertId: span.expertId,
    userPseudonym: span.userPseudonym,
    modelId: span.modelId,
    kind: span.kind,
    timestamp: span.timestamp,
    status: span.status,
    latencyMs: span.latencyMs,
    missingMetadata: span.missingMetadata,
    events: span.events,
    ...span.metadata,
  });

  return {
    id: span.id,
    name: span.name,
    run_type: RUN_TYPES[span.kind],
    start_time: span.timestamp,
    end_time: endTime,
    status: span.status === "error" ? "error" : "completed",
    tags: [`schema:v${TRACE_SCHEMA_VERSION}`, span.kind],
    extra: { metadata },
    inputs: {},
    outputs: {},
  };
}

/**
 * Buffered sink for the local LangSmith collector. Spans are queued in memory
 * and flushed by size or timer; every network error is contained here so the
 * user flow never observes an observability failure.
 */
@Injectable()
export class HttpTraceSink
  extends TraceSinkPort
  implements OnApplicationShutdown
{
  private readonly queue: TraceSpan[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: HttpTraceSinkOptions) {
    super();
  }

  override async send(span: TraceSpan): Promise<void> {
    this.enqueue(span);
  }

  private enqueue(span: TraceSpan): void {
    this.queue.push(span);

    if (this.queue.length >= Math.max(1, this.options.batchSize)) {
      void this.flush();

      return;
    }

    if (this.timer === null) {
      const timer = setTimeout(() => {
        this.timer = null;
        void this.flush();
      }, this.options.flushIntervalMs);

      timer.unref();
      this.timer = timer;
    }
  }

  async flush(): Promise<void> {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const batch = this.queue.splice(0, Math.max(1, this.options.batchSize));

    for (const span of batch) {
      try {
        await this.postRun(toLangSmithRun(span));
      } catch (error) {
        log("warn", "obs.trace.dropped", {
          event: "obs.trace.dropped",
          spanId: span.id,
          traceId: span.traceId,
          error: error instanceof Error ? error.name : "unknown",
        });
      }
    }
  }

  private async postRun(run: Record<string, unknown>): Promise<void> {
    const response = await fetch(`${this.options.endpoint}/runs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.options.apiKey,
      },
      body: JSON.stringify(run),
      signal: AbortSignal.timeout(this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`trace_ingest_http_${response.status}`);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.flush();
  }
}
