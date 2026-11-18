import { log } from "../../shared/observability/app-logger";

type DatabaseError = Error & { code?: string };

/** Reads the PostgreSQL SQLSTATE from an unknown thrown value. */
export function postgresErrorCode(error: unknown): string | undefined {
  if (error instanceof Error) {
    const code = (error as DatabaseError).code;

    return typeof code === "string" ? code : undefined;
  }

  return undefined;
}

/**
 * Logs only non-sensitive metadata (operation and SQLSTATE) and returns a
 * stable error. The raw database message/details are never logged because they
 * may echo row values (PII).
 */
export function databaseFailure(operation: string, error: unknown): Error {
  log("error", "Falha ao acessar o banco de dados", {
    operation,
    code: postgresErrorCode(error) ?? "unknown",
  });

  return new Error(`Could not ${operation}`, { cause: error });
}
