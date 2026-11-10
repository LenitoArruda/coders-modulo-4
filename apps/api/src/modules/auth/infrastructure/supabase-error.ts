import { log } from "../../shared/observability/app-logger";

/**
 * Logs only non-sensitive metadata (operation and PostgREST error code) and
 * returns a stable error. The raw database message/details are never logged
 * because they may echo row values (PII).
 */
export function databaseFailure(
  operation: string,
  error: { code?: string } | null,
): Error {
  log("error", "Falha ao acessar o banco de dados", {
    operation,
    code: error?.code ?? "unknown",
  });

  return new Error(`Could not ${operation}`);
}
