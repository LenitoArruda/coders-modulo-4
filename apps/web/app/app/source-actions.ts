"use server";

import { fetchApiWithSession } from "../../lib/auth/api-client";
import {
  ALREADY_CONNECTED_MESSAGE,
  CONNECT_SOURCES_PATH,
  MAX_FILES_PER_UPLOAD,
  MAX_SOURCE_FILE_BYTES,
  SESSION_EXPIRED_MESSAGE,
  SOURCE_CONNECT_FAILED_MESSAGE,
  SOURCE_DELETE_FAILED_MESSAGE,
  SOURCE_FORMATS_MESSAGE,
  SOURCE_LOAD_FAILED_MESSAGE,
  SOURCE_RETRY_FAILED_MESSAGE,
  type ConnectSourcesResponse,
  type ListSourcesResponse,
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
  "SOURCE_NOT_FOUND",
  "SOURCE_VERSION_NOT_FOUND",
  "VALIDATION_ERROR",
]);

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

  if (
    status >= 400 &&
    status < 500 &&
    body.code !== undefined &&
    PUBLIC_SOURCE_CODES.has(body.code)
  ) {
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

function supportedFileName(name: string): boolean {
  const normalized = name.trim().toLowerCase();

  return (
    normalized.endsWith(".pdf") ||
    normalized.endsWith(".txt") ||
    normalized.endsWith(".md") ||
    normalized.endsWith(".markdown")
  );
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
  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File);

  if (files.length === 0) {
    return failure(`Choose at least one ${SOURCE_FORMATS_MESSAGE} file.`);
  }
  if (files.length > MAX_FILES_PER_UPLOAD) {
    return failure(`Choose up to ${MAX_FILES_PER_UPLOAD} files at a time.`);
  }
  if (files.some((file) => !supportedFileName(file.name))) {
    return failure(`Only ${SOURCE_FORMATS_MESSAGE} files are supported.`);
  }
  if (
    files.some((file) => file.size === 0 || file.size > MAX_SOURCE_FILE_BYTES)
  ) {
    return failure("One of the files is too large or empty. Try another file.");
  }

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
