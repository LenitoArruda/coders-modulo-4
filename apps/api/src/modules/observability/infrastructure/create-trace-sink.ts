import { log } from "../../shared/observability/app-logger";
import { isLocalTraceEndpoint } from "../../shared/config/env";
import { TraceSinkPort } from "../application/ports/trace-sink.port";

import { HttpTraceSink } from "./http-trace.sink";
import { NoopTraceSink } from "./noop-trace.sink";

export type CreateTraceSinkOptions = {
  enabled: boolean;
  endpoint: string;
  apiKey: string;
  batchSize: number;
  flushIntervalMs: number;
};

/** Chooses the sink at boot. Disabled or invalid setups never contact a network. */
export function createTraceSink(
  options: CreateTraceSinkOptions,
): TraceSinkPort {
  if (!options.enabled) return new NoopTraceSink();

  if (!isLocalTraceEndpoint(options.endpoint)) {
    log("warn", "obs.trace.disabled", {
      event: "obs.trace.disabled",
      reason: "non_local_endpoint",
    });

    return new NoopTraceSink();
  }

  return new HttpTraceSink({
    endpoint: options.endpoint.replace(/\/+$/, ""),
    apiKey: options.apiKey,
    batchSize: options.batchSize,
    flushIntervalMs: options.flushIntervalMs,
  });
}
