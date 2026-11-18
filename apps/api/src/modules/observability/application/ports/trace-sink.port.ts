import type { TraceSpan } from "../../domain/trace-span";

/** Boundary between the application and the local trace collector. */
export abstract class TraceSinkPort {
  abstract send(span: TraceSpan): Promise<void>;
}
