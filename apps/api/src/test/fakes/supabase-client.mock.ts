import type { SupabaseClient } from "@supabase/supabase-js";

export type SupabaseQueryResult = {
  data?: unknown;
  error: { code: string; message?: string } | null;
};

export type SupabaseQueryCall = {
  method: string;
  args: unknown[];
};

const CHAIN_METHODS = [
  "from",
  "insert",
  "update",
  "select",
  "eq",
  "is",
  "gt",
  "neq",
] as const;

/**
 * Minimal chainable PostgREST mock: every chained method records its call and
 * returns the same builder, `single`/`maybeSingle` resolve the configured
 * result, and plain update chains are awaitable too (via `then`).
 */
export function createSupabaseClientMock(
  initial: SupabaseQueryResult = { data: null, error: null },
) {
  const calls: SupabaseQueryCall[] = [];
  let result = initial;
  const builder: Record<string, unknown> = {};

  for (const method of CHAIN_METHODS) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });

      return builder;
    };
  }

  builder.single = () => Promise.resolve(result);
  builder.maybeSingle = () => Promise.resolve(result);
  builder.then = (resolve: (value: SupabaseQueryResult) => unknown) =>
    resolve(result);

  return {
    client: { from: builder.from } as unknown as SupabaseClient,
    calls,
    setResult(next: SupabaseQueryResult): void {
      result = next;
    },
  };
}
