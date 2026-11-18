import type {
  Conversation,
  ConversationMessage,
  NewExchange,
} from "../../domain/conversation";

export type PersistedExchange = {
  userMessage: ConversationMessage;
  expertMessage: ConversationMessage;
};

/**
 * Persistence boundary for chat transcripts. Every method is scoped by user id
 * so no transcript can be read or written across users.
 */
export abstract class ConversationsRepositoryPort {
  abstract findByUserAndExpert(
    userId: string,
    expertId: string,
  ): Promise<Conversation | null>;

  abstract create(userId: string, expertId: string): Promise<Conversation>;

  abstract listMessages(
    conversationId: string,
    userId: string,
  ): Promise<ConversationMessage[]>;

  /** Appends both sides of one exchange, keeping user message first. */
  abstract appendExchange(
    conversationId: string,
    userId: string,
    exchange: NewExchange,
  ): Promise<PersistedExchange>;
}
