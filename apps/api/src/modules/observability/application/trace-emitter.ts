import { Inject, Injectable } from "@nestjs/common";

import { log } from "../../shared/observability/app-logger";
import { sanitizePiiMetadata } from "../domain/pii-sanitizer";
import { stripForbiddenMetadata } from "../domain/metadata-policy";
import { createTraceSpan, type TraceSpanInput } from "../domain/trace-span";
import { pseudonymizeUserId } from "../domain/user-pseudonym";
import {
  OBS_TRACING_ENABLED,
  OBS_USER_PSEUDONYM_SALT,
} from "../observability.tokens";

import { TraceSinkPort } from "./ports/trace-sink.port";

export type TraceEmissionInput = Omit<TraceSpanInput, "userPseudonym"> & {
  userId: string;
};

/**
 * Turns application events into safe spans. Emission is fire-and-forget: any
 * sanitization, validation or sink failure is logged and never propagated to
 * the request path.
 */
@Injectable()
export class TraceEmitter {
  constructor(
    @Inject(TraceSinkPort) private readonly sink: TraceSinkPort,
    @Inject(OBS_TRACING_ENABLED) private readonly enabled: boolean = false,
    @Inject(OBS_USER_PSEUDONYM_SALT) private readonly salt: string = "",
  ) {}

  emit(input: TraceEmissionInput): void {
    if (!this.enabled) return;

    const sanitized = sanitizePiiMetadata(
      stripForbiddenMetadata(input.metadata ?? {}),
    );
    const events = [
      ...new Set([
        ...(input.events ?? []),
        ...(sanitized.patterns.length > 0 ? ["obs.pii.sanitized"] : []),
      ]),
    ];
    const userPseudonym =
      input.userId.trim() === ""
        ? ""
        : pseudonymizeUserId(input.userId, this.salt);
    const span = createTraceSpan({
      ...input,
      userPseudonym,
      metadata: sanitized.metadata,
      events,
    });

    if (span.missingMetadata.length > 0) {
      log("warn", "obs.trace.missing_metadata", {
        event: "obs.trace.missing_metadata",
        spanId: span.id,
        traceId: span.traceId,
        fields: span.missingMetadata.join(","),
      });
    }

    void this.sink.send(span).catch((error: unknown) => {
      log("warn", "obs.trace.dropped", {
        event: "obs.trace.dropped",
        spanId: span.id,
        traceId: span.traceId,
        error: error instanceof Error ? error.name : "unknown",
      });
    });
  }
}
