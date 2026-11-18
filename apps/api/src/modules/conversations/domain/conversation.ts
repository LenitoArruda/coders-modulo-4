import type {
  AnswerStatus,
  Citation,
  RetrievalMetadata,
} from "../../citations/domain/citation";
import type { MediaAttachment } from "../../media/domain/media";

/** One transcript per (authenticated user, Expert). */
export type Conversation = {
  id: string;
  userId: string;
  expertId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type MessageRole = "user" | "expert";

/** A persisted chat message. Content is never written to logs or telemetry. */
export type ConversationMessage = {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
  /** Optional RAG metadata; absent on transcripts written before spec 016. */
  citations?: Citation[];
  retrieval?: RetrievalMetadata | null;
  answerStatus?: AnswerStatus;
  /** Media deliverables attached to this Expert reply (spec 017). */
  media?: MediaAttachment[];
};

export type NewExchange = {
  userContent: string;
  expertContent: string;
  citations?: Citation[];
  retrieval?: RetrievalMetadata | null;
  answerStatus?: AnswerStatus;
  media?: MediaAttachment[];
};

/** Emitted by the web when a click or submission originates a prompt. */
export type PromptSource = "typed" | "suggestion";
