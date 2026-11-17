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
};

export type NewExchange = {
  userContent: string;
  expertContent: string;
};

/** Emitted by the web when a click or submission originates a prompt. */
export type PromptSource = "typed" | "suggestion";
