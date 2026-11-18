import { TraceSinkPort } from "../../modules/observability/application/ports/trace-sink.port";
import type { TraceSpan } from "../../modules/observability/domain/trace-span";

/** Test double used by instrumentation integration tests. */
export class InMemoryTraceSink extends TraceSinkPort {
  readonly spans: TraceSpan[] = [];

  override async send(span: TraceSpan): Promise<void> {
    this.spans.push(span);
  }
}
