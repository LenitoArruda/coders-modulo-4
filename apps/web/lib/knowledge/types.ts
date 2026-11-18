/**
 * Serialized knowledge-source contracts shared by the private home and the
 * source panel. The API remains the source of truth for status and ownership.
 */

export type SourceStatus = "queued" | "processing" | "ready" | "failed";
export type MediaType = "image" | "audio" | "video";
export type SourceType = "pdf" | "txt" | "markdown" | MediaType;
export type ProcessingPhase = "extracting" | "chunking" | "embedding";

export type SourceSummary = {
  id: string;
  name: string;
  /** Present only for URL sources; `name` then holds the extracted page title. */
  url?: string;
  type: SourceType;
  byteSize: number;
  status: SourceStatus;
  versionId: string;
  versionNumber: number;
  chunkCount: number;
  isStale: boolean;
  createdAt: string;
  processingPhase?: ProcessingPhase | null;
  mediaType?: MediaType | null;
  durationSeconds?: number | null;
  extractionMethod?: string | null;
  extractionModelVersion?: string | null;
  errorMessage?: string | null;
};

export type ConnectedSourceResult = {
  name: string;
  url?: string;
  type: SourceType;
  byteSize: number;
  sourceId: string;
  versionId: string;
  status: SourceStatus;
  alreadyConnected: boolean;
  processingPhase?: ProcessingPhase | null;
  mediaType?: MediaType | null;
  durationSeconds?: number | null;
};

export type ListSourcesResponse = { sources: SourceSummary[] };
export type ConnectSourcesResponse = { results: ConnectedSourceResult[] };

export type SourceActionResult<T> =
  { ok: true; data: T; message?: string } | { ok: false; message: string };

export const CONNECT_SOURCES_PATH = "/api/v1/sources";
export const CONNECT_SOURCE_URL_PATH = "/api/v1/sources/urls";

/** Mirrors the API domain limits; the API validates again on every request. */
export const MAX_SOURCE_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_AUDIO_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_FILE_BYTES = 200 * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = 5;
export const MAX_MEDIA_DURATION_SECONDS = 60 * 60;

export const SOURCE_FORMATS_MESSAGE = "PDF, TXT or Markdown";
export const MEDIA_FORMATS_MESSAGE = "JPEG, PNG, MP3 or MP4";
export const ALL_SOURCE_FORMATS_MESSAGE =
  "PDF, TXT, Markdown, JPEG, PNG, MP3 or MP4";
export const MEDIA_ACCEPT =
  ".jpg,.jpeg,.png,.mp3,.mp4,image/jpeg,image/png,audio/mpeg,video/mp4";
export const DOCUMENT_ACCEPT =
  ".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown";

export const SOURCE_EMPTY_MESSAGE =
  "No sources connected yet. Use the add button to connect a document.";
export const SOURCE_CONNECT_FAILED_MESSAGE =
  "We could not connect these files. Try again.";
export const SOURCE_URL_REQUIRED_MESSAGE = "Enter a public HTTP or HTTPS URL.";
export const SOURCE_URL_CONNECT_FAILED_MESSAGE =
  "We could not connect this URL. Try again.";
export const SOURCE_LOAD_FAILED_MESSAGE =
  "We could not load your sources. Try again.";
export const SOURCE_DELETE_FAILED_MESSAGE =
  "We could not remove this source. Try again.";
export const SOURCE_RETRY_FAILED_MESSAGE =
  "We could not retry this source. Try again.";
export const SESSION_EXPIRED_MESSAGE =
  "Your session has expired. Sign in again.";
export const ALREADY_CONNECTED_MESSAGE = "Already connected";
export const NO_SPEECH_DETECTED_MESSAGE = "No speech detected";

export function isMediaType(type: SourceType): type is MediaType {
  return type === "image" || type === "audio" || type === "video";
}

export function formatSourceSize(byteSize: number): string {
  if (byteSize < 1024) return `${byteSize} B`;

  const kilobytes = byteSize / 1024;

  return `${kilobytes < 10 ? kilobytes.toFixed(1) : Math.round(kilobytes)} KB`;
}
