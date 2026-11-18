"use server";

import { fetchApiWithSession } from "../../lib/auth/api-client";
import type {
  ChatActionResult,
  MediaAttachment,
} from "../../lib/expert-chat/types";

const MEDIA_PATH = "/api/v1/media";

const MEDIA_ACTION_FAILED_MESSAGE = "We could not update this file. Try again.";
const MEDIA_NOT_FOUND_MESSAGE = "That file is no longer available.";

async function call<T>(
  path: string,
  init: RequestInit,
): Promise<ChatActionResult<T>> {
  try {
    const response = await fetchApiWithSession(path, {
      ...init,
      cache: "no-store",
    });

    if (response.status === 404) {
      return { ok: false, message: MEDIA_NOT_FOUND_MESSAGE };
    }
    if (!response.ok) {
      return { ok: false, message: MEDIA_ACTION_FAILED_MESSAGE };
    }

    return { ok: true, data: (await response.json()) as T };
  } catch {
    return { ok: false, message: MEDIA_ACTION_FAILED_MESSAGE };
  }
}

/** Polls current public metadata for one deliverable owned by the session. */
export async function getMediaStatusAction(
  mediaId: string,
): Promise<ChatActionResult<MediaAttachment>> {
  if (mediaId.trim() === "") {
    return { ok: false, message: MEDIA_NOT_FOUND_MESSAGE };
  }

  return call(`${MEDIA_PATH}/${encodeURIComponent(mediaId)}/status`, {
    method: "GET",
  });
}

/** Cancels a queued generation and discards any partial file. */
export async function cancelMediaAction(
  mediaId: string,
): Promise<ChatActionResult<MediaAttachment>> {
  if (mediaId.trim() === "") {
    return { ok: false, message: MEDIA_NOT_FOUND_MESSAGE };
  }

  return call(`${MEDIA_PATH}/${encodeURIComponent(mediaId)}/cancel`, {
    method: "POST",
  });
}

/** Reuses the validated parameters of a failed generation (max. 3 attempts). */
export async function retryMediaAction(
  mediaId: string,
): Promise<ChatActionResult<MediaAttachment>> {
  if (mediaId.trim() === "") {
    return { ok: false, message: MEDIA_NOT_FOUND_MESSAGE };
  }

  return call(`${MEDIA_PATH}/${encodeURIComponent(mediaId)}/retry`, {
    method: "POST",
  });
}
