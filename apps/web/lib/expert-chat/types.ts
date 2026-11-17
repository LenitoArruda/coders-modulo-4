/**
 * Contracts shared by the server and client sides of the Expert chat. The API
 * remains the single source of truth for the catalog; these are only the
 * serialized shapes the web renders.
 */

export type Expert = {
  id: string;
  name: string;
  role: string;
  scope: string;
  tone: string;
  suggestions: string[];
};

export type ChatMessage = {
  id: string;
  role: "user" | "expert";
  content: string;
  createdAt: string;
};

export type ExpertsResponse = {
  experts: Expert[];
};

export type ConversationResponse = {
  conversationId: string | null;
  messages: ChatMessage[];
};

export type SendMessageResponse = {
  conversationId: string;
  userMessage: ChatMessage;
  expertMessage: ChatMessage;
};

export type ChatActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      message: string;
      fieldErrors?: Record<string, string>;
    };

export type PromptSource = "typed" | "suggestion";

/** Mirrors the API default (`EXPERT_PROMPT_MAX_LENGTH`); the API validates too. */
export const PROMPT_MAX_LENGTH = 4_000;

export const EMPTY_PROMPT_MESSAGE = "Enter a message before sending.";
export const PROMPT_TOO_LONG_MESSAGE =
  "Keep your message shorter and try again.";
export const LOAD_FAILED_MESSAGE =
  "We could not load this conversation. Try again.";
export const SEND_FAILED_MESSAGE =
  "The Expert could not respond right now. Try again in a moment.";
export const SESSION_EXPIRED_MESSAGE =
  "Your session has expired. Sign in again.";
