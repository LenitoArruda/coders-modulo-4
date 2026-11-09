import { context, logs, SeverityNumber, trace } from "@opentelemetry/api";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogAttributes = Record<
  string,
  string | number | boolean | undefined
>;

const severity: Record<LogLevel, { number: SeverityNumber; text: string }> = {
  debug: { number: SeverityNumber.DEBUG, text: "DEBUG" },
  info: { number: SeverityNumber.INFO, text: "INFO" },
  warn: { number: SeverityNumber.WARN, text: "WARN" },
  error: { number: SeverityNumber.ERROR, text: "ERROR" },
};

const otelLogger = logs.getLogger("coders-modulo-4-api");

function normalizeAttributes(
  attributes: LogAttributes,
): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(attributes).filter(
      (entry): entry is [string, string | number | boolean] =>
        entry[1] !== undefined,
    ),
  );
}

export function log(
  level: LogLevel,
  message: string,
  attributes: LogAttributes = {},
): void {
  const activeSpan = trace.getSpan(context.active());
  const traceId =
    attributes.traceId ?? activeSpan?.spanContext().traceId ?? undefined;
  const normalizedAttributes = normalizeAttributes({
    ...attributes,
    ...(traceId ? { traceId } : {}),
  });
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    service: "coders-modulo-4-api",
    message,
    ...normalizedAttributes,
  };
  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }

  otelLogger.emit({
    severityNumber: severity[level].number,
    severityText: severity[level].text,
    body: message,
    attributes: normalizedAttributes,
  });
}
