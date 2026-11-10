import { SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";

export type DbOperation = "SELECT" | "INSERT" | "UPDATE" | "DELETE";

export type DbSpanTarget = {
  table: string;
  operation: DbOperation;
};

/** Shape shared by every supabase-js (PostgREST) response. */
type DbResult = { error: { code?: string } | null };

const TRACER_NAME = "coders-modulo-4-api";

/**
 * Runs a PostgREST query inside a CLIENT span so database calls show up in
 * traces and span metrics (e.g. `SELECT users`).
 *
 * supabase-js reports failures through `result.error` instead of throwing, so
 * the span is marked as an error from that field. Only the table, the
 * operation and the PostgREST error code are recorded: never filter values or
 * the raw error message, which can echo row data (PII).
 */
export function withDbSpan<T extends DbResult>(
  { table, operation }: DbSpanTarget,
  query: PromiseLike<T>,
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
        const result = await query;

        if (result.error !== null) {
          const code = result.error.code ?? "unknown";
          span.setAttribute("db.response.status_code", code);
          span.setAttribute("error.type", code);
          span.setStatus({ code: SpanStatusCode.ERROR });
        }

        return result;
      } catch (error) {
        span.setAttribute(
          "error.type",
          error instanceof Error ? error.name : "unknown",
        );
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    },
  );
}
