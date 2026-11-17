"use server";

import { fetchApiWithSession } from "../../lib/auth/api-client";
import {
  EMPTY_PROMPT_MESSAGE,
  LOAD_FAILED_MESSAGE,
  PROMPT_MAX_LENGTH,
  PROMPT_TOO_LONG_MESSAGE,
  SEND_FAILED_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  type ChatActionResult,
  type ConversationResponse,
  type ExpertsResponse,
  type PromptSource,
  type SendMessageResponse,
} from "../../lib/expert-chat/types";

const EXPERTS_PATH = "/api/v1/experts";
const CONVERSATIONS_PATH = "/api/v1/conversations";
const MESSAGES_PATH = "/api/v1/conversations/messages";

type ApiError = {
  code?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
};

async function readErrorBody(response: Response): Promise<ApiError> {
  try {
    const body: unknown = await response.json();

    return typeof body === "object" && body !== null ? (body as ApiError) : {};
  } catch {
    return {};
  }
}

function failure<T>(
  message: string,
  fieldErrors?: Record<string, string>,
): ChatActionResult<T> {
  return fieldErrors === undefined
    ? { ok: false, message }
    : { ok: false, message, fieldErrors };
}

/** Maps an API error to short, actionable copy. Never forwards raw details. */
function apiFailure<T>(status: number, body: ApiError, fallback: string) {
  if (status === 401) {
    return failure<T>(SESSION_EXPIRED_MESSAGE);
  }

  if (status === 400 && body.fieldErrors !== undefined) {
    return failure<T>(body.message ?? fallback, body.fieldErrors);
  }

  return failure<T>(fallback);
}

/** Lists the catalog through the server; the token never reaches the client. */
export async function listExpertsAction(): Promise<
  ChatActionResult<ExpertsResponse>
> {
  let response: Response;

  try {
    response = await fetchApiWithSession(EXPERTS_PATH, { cache: "no-store" });
  } catch {
    return failure(LOAD_FAILED_MESSAGE);
  }

  if (!response.ok) {
    return apiFailure(
      response.status,
      await readErrorBody(response),
      LOAD_FAILED_MESSAGE,
    );
  }

  return { ok: true, data: (await response.json()) as ExpertsResponse };
}

/** Loads one Expert's transcript, scoped by the session on the API side. */
export async function loadConversationAction(
  expertId: string,
): Promise<ChatActionResult<ConversationResponse>> {
  if (expertId.trim() === "") {
    return failure(LOAD_FAILED_MESSAGE);
  }

  let response: Response;

  try {
    const query = new URLSearchParams({ expertId: expertId.trim() });

    response = await fetchApiWithSession(`${CONVERSATIONS_PATH}?${query}`, {
      cache: "no-store",
    });
  } catch {
    return failure(LOAD_FAILED_MESSAGE);
  }

  if (!response.ok) {
    return apiFailure(
      response.status,
      await readErrorBody(response),
      LOAD_FAILED_MESSAGE,
    );
  }

  return { ok: true, data: (await response.json()) as ConversationResponse };
}

/**
 * Sends a prompt and returns the persisted exchange. Empty prompts and prompts
 * over the configured limit are rejected locally, without calling the model.
 */
export async function sendPromptAction(
  expertId: string,
  prompt: string,
  source: PromptSource = "typed",
): Promise<ChatActionResult<SendMessageResponse>> {
  const fieldErrors: Record<string, string> = {};
  const trimmedPrompt = prompt.trim();

  if (expertId.trim() === "") {
    fieldErrors.expertId = "Choose an Expert and try again.";
  }
  if (trimmedPrompt === "") {
    fieldErrors.prompt = EMPTY_PROMPT_MESSAGE;
  } else if (trimmedPrompt.length > PROMPT_MAX_LENGTH) {
    fieldErrors.prompt = PROMPT_TOO_LONG_MESSAGE;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure("Check your message and try again.", fieldErrors);
  }

  let response: Response;

  try {
    response = await fetchApiWithSession(MESSAGES_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        expertId: expertId.trim(),
        prompt: trimmedPrompt,
        source,
      }),
    });
  } catch {
    return failure(SEND_FAILED_MESSAGE);
  }

  if (!response.ok) {
    return apiFailure(
      response.status,
      await readErrorBody(response),
      SEND_FAILED_MESSAGE,
    );
  }

  return { ok: true, data: (await response.json()) as SendMessageResponse };
}
