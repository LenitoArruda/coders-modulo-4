/**
 * Serialized knowledge-source contracts shared by the private home and the
 * source panel. The API remains the source of truth for status and ownership.
 */

export type SourceStatus = "queued" | "processing" | "ready" | "failed";
export type SourceType = "pdf" | "txt" | "markdown";

export type SourceSummary = {
  id: string;
  name: string;
  type: SourceType;
  byteSize: number;
  status: SourceStatus;
  versionId: string;
  versionNumber: number;
  chunkCount: number;
  isStale: boolean;
  createdAt: string;
};

export type ConnectedSourceResult = {
  name: string;
  type: SourceType;
  byteSize: number;
  sourceId: string;
  versionId: string;
  status: SourceStatus;
  alreadyConnected: boolean;
};

export type ListSourcesResponse = { sources: SourceSummary[] };
export type ConnectSourcesResponse = { results: ConnectedSourceResult[] };

export type SourceActionResult<T> =
  { ok: true; data: T; message?: string } | { ok: false; message: string };

export const CONNECT_SOURCES_PATH = "/api/v1/sources";

/** Mirrors the API domain limits; the API validates again on every request. */
export const MAX_SOURCE_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = 5;

export const SOURCE_FORMATS_MESSAGE = "PDF, TXT or Markdown";
export const SOURCE_EMPTY_MESSAGE =
  "No sources connected yet. Use the add button to connect a document.";
export const SOURCE_CONNECT_FAILED_MESSAGE =
  "We could not connect these files. Try again.";
export const SOURCE_LOAD_FAILED_MESSAGE =
  "We could not load your sources. Try again.";
export const SOURCE_DELETE_FAILED_MESSAGE =
  "We could not remove this source. Try again.";
export const SOURCE_RETRY_FAILED_MESSAGE =
  "We could not retry this source. Try again.";
export const SESSION_EXPIRED_MESSAGE =
  "Your session has expired. Sign in again.";
export const ALREADY_CONNECTED_MESSAGE = "Already connected";

export function formatSourceSize(byteSize: number): string {
  if (byteSize < 1024) return `${byteSize} B`;

  const kilobytes = byteSize / 1024;

  return `${kilobytes < 10 ? kilobytes.toFixed(1) : Math.round(kilobytes)} KB`;
}
