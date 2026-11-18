import type { Pool, QueryResult } from "pg";

export type PgQueryCall = {
  /** SQL with runs of whitespace collapsed to a single space, for easy assertions. */
  text: string;
  params?: unknown[];
};

export type PgQueryResponse =
  { rows?: unknown[]; rowCount?: number | null } | Error;

function normalize(sql: string): string {
  return sql.replace(/\s+/g, " ").trim();
}

/**
 * Minimal `pg.Pool` fake: every `query` call is recorded and resolves the next
 * queued response (or rejects when the queued value is an Error). The default
 * `rowCount` is the number of returned rows, matching `pg` behaviour.
 */
export function createPgPoolMock(...queue: PgQueryResponse[]) {
  const calls: PgQueryCall[] = [];
  let index = 0;

  const pool = {
    query: async (text: string, params?: unknown[]) => {
      calls.push({ text: normalize(text), params });

      const response = queue[index];
      index += 1;

      if (response === undefined) {
        throw new Error(`unexpected query: ${normalize(text)}`);
      }

      if (response instanceof Error) {
        throw response;
      }

      const rows = response.rows ?? [];

      return {
        rows,
        rowCount: response.rowCount ?? rows.length,
        command: "",
        oid: 0,
        fields: [],
      } satisfies QueryResult;
    },
  } as unknown as Pool;

  return { pool, calls };
}

/** Builds a PostgreSQL error with a SQLSTATE, as `pg` would surface it. */
export function pgError(code: string, message = "database error"): Error {
  return Object.assign(new Error(message), { code });
}
