import type { PromptSource } from "./conversation";

export const EMPTY_PROMPT_MESSAGE = "Enter a message before sending.";
export const PROMPT_TOO_LONG_MESSAGE =
  "Keep your message shorter and try again.";
export const INVALID_EXPERT_MESSAGE = "Choose an Expert and try again.";
export const INVALID_SOURCE_MESSAGE = "The request could not be processed.";

export type SendMessageInput = {
  expertId: string;
  prompt: string;
  source: PromptSource;
};

export type SendMessageValidation =
  | { ok: true; value: SendMessageInput }
  | { ok: false; fieldErrors: Record<string, string> };

function isPromptSource(value: unknown): value is PromptSource {
  return value === "typed" || value === "suggestion";
}

/**
 * Validates the untrusted request body before any use case or model call.
 * The trimmed prompt is returned so storage and telemetry stay consistent.
 */
export function validateSendMessageInput(
  body: unknown,
  promptMaxLength: number,
): SendMessageValidation {
  const candidate =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};
  const fieldErrors: Record<string, string> = {};

  const expertId =
    typeof candidate.expertId === "string" ? candidate.expertId.trim() : "";
  if (expertId === "") {
    fieldErrors.expertId = INVALID_EXPERT_MESSAGE;
  }

  const rawPrompt =
    typeof candidate.prompt === "string" ? candidate.prompt.trim() : "";
  if (rawPrompt === "") {
    fieldErrors.prompt = EMPTY_PROMPT_MESSAGE;
  } else if (rawPrompt.length > promptMaxLength) {
    fieldErrors.prompt = PROMPT_TOO_LONG_MESSAGE;
  }

  const source = candidate.source ?? "typed";
  if (!isPromptSource(source)) {
    fieldErrors.source = INVALID_SOURCE_MESSAGE;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    value: { expertId, prompt: rawPrompt, source: source as PromptSource },
  };
}
