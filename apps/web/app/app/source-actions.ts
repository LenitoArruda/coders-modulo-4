"use server";

import { fetchApiWithSession } from "../../lib/auth/api-client";
import { isKnowledgeMediaEnabled } from "../../lib/knowledge/flags";
import {
  ALREADY_CONNECTED_MESSAGE,
  ALL_SOURCE_FORMATS_MESSAGE,
  CONNECT_SOURCES_PATH,
  CONNECT_SOURCE_URL_PATH,
  MAX_AUDIO_FILE_BYTES,
  MAX_FILES_PER_UPLOAD,
  MAX_IMAGE_FILE_BYTES,
  MAX_MEDIA_DURATION_SECONDS,
  MAX_SOURCE_FILE_BYTES,
  MAX_VIDEO_FILE_BYTES,
  SESSION_EXPIRED_MESSAGE,
  SOURCE_CONNECT_FAILED_MESSAGE,
  SOURCE_DELETE_FAILED_MESSAGE,
  SOURCE_FORMATS_MESSAGE,
  SOURCE_LOAD_FAILED_MESSAGE,
  SOURCE_RETRY_FAILED_MESSAGE,
  SOURCE_URL_CONNECT_FAILED_MESSAGE,
  SOURCE_URL_REQUIRED_MESSAGE,
  type ConnectSourcesResponse,
  type ListSourcesResponse,
  type MediaType,
  type SourceActionResult,
} from "../../lib/knowledge/types";

type ApiError = {
  code?: string;
  message?: string;
};

/** Codes whose messages are already actionable, en-US and free of internals. */
const PUBLIC_SOURCE_CODES = new Set([
  "UNSUPPORTED_SOURCE_FILE",
  "SOURCE_FILE_TOO_LARGE",
  "TOO_MANY_SOURCE_FILES",
  "EMPTY_SOURCE_FILE",
  "MEDIA_DURATION_TOO_LONG",
  "INVALID_MEDIA_DURATION",
  "NO_SPEECH_DETECTED",
  "MEDIA_EXTRACTION_UNAVAILABLE",
  "SOURCE_PROCESSING_FAILED",
  "SOURCE_VECTOR_STORE_UNAVAILABLE",
  "SOURCE_EMBEDDING_UNAVAILABLE",
  "SOURCE_NOT_FOUND",
  "SOURCE_VERSION_NOT_FOUND",
  "INVALID_SOURCE_URL",
  "BLOCKED_SOURCE_URL",
  "SOURCE_URL_UNAVAILABLE",
  "SOURCE_URL_NO_TEXT",
  "SOURCE_URL_TOO_LARGE",
  "VALIDATION_ERROR",
]);

const DOCUMENT_EXTENSIONS = [".pdf", ".txt", ".md", ".markdown"];
const MEDIA_EXTENSIONS: Record<string, MediaType> = {
  ".jpg": "image",
  ".jpeg": "image",
  ".png": "image",
  ".mp3": "audio",
  ".mp4": "video",
};

const MEDIA_SIZE_LIMITS: Record<MediaType, number> = {
  image: MAX_IMAGE_FILE_BYTES,
  audio: MAX_AUDIO_FILE_BYTES,
  video: MAX_VIDEO_FILE_BYTES,
};

async function readErrorBody(response: Response): Promise<ApiError> {
  try {
    const body: unknown = await response.json();

    return typeof body === "object" && body !== null ? (body as ApiError) : {};
  } catch {
    return {};
  }
}

function failure<T>(message: string): SourceActionResult<T> {
  return { ok: false, message };
}

function apiFailure<T>(
  status: number,
  body: ApiError,
  fallback: string,
): SourceActionResult<T> {
  if (status === 401) return failure<T>(SESSION_EXPIRED_MESSAGE);

  if (body.code !== undefined && PUBLIC_SOURCE_CODES.has(body.code)) {
    return failure<T>(body.message ?? fallback);
  }

  return failure<T>(fallback);
}

async function readJson<T>(response: Response): Promise<SourceActionResult<T>> {
  try {
    return { ok: true, data: (await response.json()) as T };
  } catch {
    return failure("The response could not be read. Try again.");
  }
}

function mediaTypeForName(name: string): MediaType | null {
  const normalized = name.trim().toLowerCase();

  return (
    Object.entries(MEDIA_EXTENSIONS).find(([extension]) =>
      normalized.endsWith(extension),
    )?.[1] ?? null
  );
}

function supportedFileName(name: string, mediaEnabled: boolean): boolean {
  const normalized = name.trim().toLowerCase();
  const isDocument = DOCUMENT_EXTENSIONS.some((extension) =>
    normalized.endsWith(extension),
  );

  return isDocument || (mediaEnabled && mediaTypeForName(name) !== null);
}

function maxBytesFor(file: File, mediaEnabled: boolean): number {
  if (mediaEnabled) {
    const mediaType = mediaTypeForName(file.name);

    if (mediaType !== null) return MEDIA_SIZE_LIMITS[mediaType];
  }

  return MAX_SOURCE_FILE_BYTES;
}

function validateDuration(value: FormDataEntryValue | null): string | null {
  if (value === null || typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const seconds = Number(value.trim());

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "Enter a valid duration in seconds, up to 60 minutes.";
  }
  if (seconds > MAX_MEDIA_DURATION_SECONDS) {
    return "Media longer than 60 minutes is not supported. Try a shorter file.";
  }

  return null;
}

/** Lists only the authenticated user's sources; the token stays on the server. */
export async function listSourcesAction(): Promise<
  SourceActionResult<ListSourcesResponse>
> {
  let response: Response;

  try {
    response = await fetchApiWithSession(CONNECT_SOURCES_PATH, {
      cache: "no-store",
    });
  } catch {
    return failure(SOURCE_LOAD_FAILED_MESSAGE);
  }

  if (!response.ok) {
    return apiFailure(
      response.status,
      await readErrorBody(response),
      SOURCE_LOAD_FAILED_MESSAGE,
    );
  }

  return readJson<ListSourcesResponse>(response);
}

/**
 * Forwards the browser's multipart payload to the API. The session token is
 * added by the shared server-only API client; it is never part of FormData.
 */
export async function connectSourcesAction(
  formData: FormData,
): Promise<SourceActionResult<ConnectSourcesResponse>> {
  const mediaEnabled = await isKnowledgeMediaEnabled();
  const formats = mediaEnabled
    ? ALL_SOURCE_FORMATS_MESSAGE
    : SOURCE_FORMATS_MESSAGE;

  // The flag is resolved on the server; a client cannot enable media here.
  formData.delete("allowMedia");

  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File);

  if (files.length === 0) {
    return failure(`Choose at least one ${formats} file.`);
  }
  if (files.length > MAX_FILES_PER_UPLOAD) {
    return failure(`Choose up to ${MAX_FILES_PER_UPLOAD} files at a time.`);
  }
  if (files.some((file) => !supportedFileName(file.name, mediaEnabled))) {
    return failure(`Only ${formats} files are supported.`);
  }
  if (
    files.some(
      (file) => file.size === 0 || file.size > maxBytesFor(file, mediaEnabled),
    )
  ) {
    return failure("One of the files is too large. Try a smaller file.");
  }

  const hasMedia = files.some((file) => mediaTypeForName(file.name) !== null);

  if (hasMedia) {
    const durationError = validateDuration(formData.get("durationSeconds"));

    if (durationError !== null) return failure(durationError);
  }

  if (mediaEnabled) formData.set("allowMedia", "true");

  let response: Response;

  try {
    response = await fetchApiWithSession(CONNECT_SOURCES_PATH, {
      method: "POST",
      body: formData,
      cache: "no-store",
    });
  } catch {
    return failure(SOURCE_CONNECT_FAILED_MESSAGE);
  }

  if (!response.ok) {
    return apiFailure(
      response.status,
      await readErrorBody(response),
      SOURCE_CONNECT_FAILED_MESSAGE,
    );
  }

  const result = await readJson<ConnectSourcesResponse>(response);

  if (result.ok && result.data.results.every((item) => item.alreadyConnected)) {
    return {
      ok: true,
      data: result.data,
      message: ALREADY_CONNECTED_MESSAGE,
    };
  }

  return result;
}

/**
 * Sends one public URL to the API. The session token is added server-side and
 * never becomes part of the browser payload.
 */
export async function connectSourceUrlAction(
  url: string,
): Promise<SourceActionResult<ConnectSourcesResponse>> {
  const trimmed = url.trim();

  if (trimmed.length === 0) return failure(SOURCE_URL_REQUIRED_MESSAGE);

  let response: Response;

  try {
    response = await fetchApiWithSession(CONNECT_SOURCE_URL_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: trimmed }),
      cache: "no-store",
    });
  } catch {
    return failure(SOURCE_URL_CONNECT_FAILED_MESSAGE);
  }

  if (!response.ok) {
    return apiFailure(
      response.status,
      await readErrorBody(response),
      SOURCE_URL_CONNECT_FAILED_MESSAGE,
    );
  }

  const result = await readJson<ConnectSourcesResponse>(response);

  if (result.ok && result.data.results.every((item) => item.alreadyConnected)) {
    return {
      ok: true,
      data: result.data,
      message: ALREADY_CONNECTED_MESSAGE,
    };
  }

  return result;
}

/** Removes one source and every version, chunk and vector behind it. */
export async function deleteSourceAction(
  sourceId: string,
): Promise<SourceActionResult<{ id: string; deleted: true }>> {
  if (sourceId.trim() === "") return failure(SOURCE_DELETE_FAILED_MESSAGE);

  let response: Response;

  try {
    response = await fetchApiWithSession(
      `${CONNECT_SOURCES_PATH}/${encodeURIComponent(sourceId.trim())}`,
      { method: "DELETE", cache: "no-store" },
    );
  } catch {
    return failure(SOURCE_DELETE_FAILED_MESSAGE);
  }

  if (!response.ok) {
    return apiFailure(
      response.status,
      await readErrorBody(response),
      SOURCE_DELETE_FAILED_MESSAGE,
    );
  }

  return { ok: true, data: { id: sourceId, deleted: true } };
}

/** Retries indexing for a failed version after clearing partial vectors. */
export async function retrySourceVersionAction(
  versionId: string,
): Promise<SourceActionResult<{ versionId: string; status: "processing" }>> {
  if (versionId.trim() === "") return failure(SOURCE_RETRY_FAILED_MESSAGE);

  let response: Response;

  try {
    response = await fetchApiWithSession(
      `${CONNECT_SOURCES_PATH}/${encodeURIComponent(versionId.trim())}/retry`,
      { method: "POST", cache: "no-store" },
    );
  } catch {
    return failure(SOURCE_RETRY_FAILED_MESSAGE);
  }

  if (!response.ok) {
    return apiFailure(
      response.status,
      await readErrorBody(response),
      SOURCE_RETRY_FAILED_MESSAGE,
    );
  }

  return { ok: true, data: { versionId, status: "processing" } };
}
