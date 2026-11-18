/** Version of the span contract shared by the API, local collector and datasets. */
export const TRACE_SCHEMA_VERSION = 1 as const;

/** Marker used when a mandatory correlation field is not available. */
export const MISSING_METADATA_MARKER = "missing";

export type TraceSpanKind =
  "chat" | "retrieval" | "generation" | "media" | "source";

export type TraceStatus =
  "ok" | "error" | "unavailable" | "no_match" | "degraded";

/** Correlation passed from the root chat span to child spans in one request. */
export type TraceCorrelation = {
  traceId: string;
  parentSpanId: string;
  userId: string;
  expertId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  modelId?: string | null;
};

export const REQUIRED_TRACE_METADATA = [
  "traceId",
  "conversationId",
  "messageId",
  "expertId",
  "userPseudonym",
  "modelId",
  "timestamp",
  "status",
  "latencyMs",
] as const;

export type RequiredTraceMetadata = (typeof REQUIRED_TRACE_METADATA)[number];

export type TraceSpanInput = {
  id: string;
  traceId: string;
  parentSpanId?: string | null;
  name: string;
  kind: TraceSpanKind;
  startedAt: number;
  endedAt?: number;
  status: TraceStatus;
  conversationId?: string | null;
  messageId?: string | null;
  expertId?: string | null;
  userPseudonym?: string | null;
  modelId?: string | null;
  metadata?: Record<string, unknown>;
  events?: string[];
};

export type TraceSpan = {
  schemaVersion: typeof TRACE_SCHEMA_VERSION;
  id: string;
  traceId: string;
  parentSpanId: string | null;
  name: string;
  kind: TraceSpanKind;
  timestamp: string;
  status: TraceStatus;
  latencyMs: number;
  conversationId: string;
  messageId: string;
  expertId: string;
  userPseudonym: string;
  modelId: string;
  metadata: Record<string, unknown>;
  events: string[];
  missingMetadata: RequiredTraceMetadata[];
};

function requiredValue(value: string | null | undefined): string {
  return typeof value === "string" && value.trim() !== ""
    ? value
    : MISSING_METADATA_MARKER;
}

/**
 * Builds a versioned span. Missing correlation fields are marked instead of
 * throwing: observability must never break the user flow it observes.
 */
export function createTraceSpan(input: TraceSpanInput): TraceSpan {
  const missingMetadata: RequiredTraceMetadata[] = [];
  const correlation = {
    traceId: input.traceId,
    conversationId: input.conversationId,
    messageId: input.messageId,
    expertId: input.expertId,
    userPseudonym: input.userPseudonym,
    modelId: input.modelId,
  } as const;

  for (const field of [
    "traceId",
    "conversationId",
    "messageId",
    "expertId",
    "userPseudonym",
    "modelId",
  ] as const) {
    if (requiredValue(correlation[field]) === MISSING_METADATA_MARKER) {
      missingMetadata.push(field);
    }
  }

  return {
    schemaVersion: TRACE_SCHEMA_VERSION,
    id: input.id,
    traceId: requiredValue(input.traceId),
    parentSpanId: input.parentSpanId ?? null,
    name: input.name,
    kind: input.kind,
    timestamp: new Date(input.startedAt).toISOString(),
    status: input.status,
    latencyMs: Math.max(
      0,
      (input.endedAt ?? input.startedAt) - input.startedAt,
    ),
    conversationId: requiredValue(input.conversationId),
    messageId: requiredValue(input.messageId),
    expertId: requiredValue(input.expertId),
    userPseudonym: requiredValue(input.userPseudonym),
    modelId: requiredValue(input.modelId),
    metadata: input.metadata ?? {},
    events: input.events ?? [],
    missingMetadata,
  };
}
