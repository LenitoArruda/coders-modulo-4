import type { TraceSpan } from "../domain/trace-span";
import { TraceSinkPort } from "../application/ports/trace-sink.port";

/** Default sink: the feature is flag-gated and emits nothing when disabled. */
export class NoopTraceSink extends TraceSinkPort {
  override async send(_span: TraceSpan): Promise<void> {
    return Promise.resolve();
  }
}
