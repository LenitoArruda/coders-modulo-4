import { SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";

export type DbOperation = "SELECT" | "INSERT" | "UPDATE" | "DELETE";

export type DbSpanTarget = {
  table: string;
  operation: DbOperation;
};

const TRACER_NAME = "coders-modulo-4-api";

function errorCode(error: unknown): string | undefined {
  if (error instanceof Error) {
    const code = (error as Error & { code?: unknown }).code;

    return typeof code === "string" ? code : undefined;
  }

  return undefined;
}

/**
 * Runs a `pg` query inside a CLIENT span so database calls show up in traces
 * and span metrics (e.g. `SELECT users`).
 *
 * `pg` rejects the promise on failure, so the span is marked as an error with
 * the SQLSTATE. Only the table, the operation and the SQLSTATE are recorded:
 * never filter values or the raw error message, which can echo row data (PII).
 */
export function withDbSpan<T>(
  { table, operation }: DbSpanTarget,
  query: () => Promise<T>,
): Promise<T> {
  return trace.getTracer(TRACER_NAME).startActiveSpan(
    `${operation} ${table}`,
    {
      kind: SpanKind.CLIENT,
      attributes: {
        "db.system": "postgresql",
        "db.system.name": "postgresql",
        "db.collection.name": table,
        "db.operation.name": operation,
      },
    },
    async (span) => {
      try {
        return await query();
      } catch (error) {
        const code = errorCode(error) ?? "unknown";
        span.setAttribute("db.response.status_code", code);
        span.setAttribute("error.type", code);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    },
  );
}
