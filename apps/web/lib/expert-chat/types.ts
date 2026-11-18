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

export type CitationLocation = {
  page?: number;
  line?: number;
  timestampSeconds?: number;
  label: string;
};

export type Citation = {
  citationNumber: number;
  sourceId: string;
  sourceVersionId: string;
  chunkIndex: number;
  sourceName: string;
  sourceType: string;
  location: CitationLocation;
  snippet: string;
  isStale: boolean;
  sourceRemoved: boolean;
};

export type RetrievalMetadata = {
  queryEmbeddingModel: string;
  vectorIndex: string;
  topK: number;
  threshold: number;
  scores: number[];
  latencyMs: number;
  chunksConsidered: number;
  status: "matched" | "no_match" | "unavailable";
};

export type AnswerStatus =
  "plain" | "with_source" | "no_match" | "retrieval_unavailable";

export type ChatMessage = {
  id: string;
  role: "user" | "expert";
  content: string;
  createdAt: string;
  citations?: Citation[];
  retrieval?: RetrievalMetadata | null;
  answerStatus?: AnswerStatus;
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
