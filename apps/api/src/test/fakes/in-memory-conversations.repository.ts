import { randomUUID } from "node:crypto";

import {
  ConversationsRepositoryPort,
  type PersistedExchange,
} from "../../modules/conversations/application/ports/conversations-repository.port";
import type {
  Conversation,
  ConversationMessage,
  NewExchange,
} from "../../modules/conversations/domain/conversation";

/** In-memory fake used by unit and integration tests. */
export class InMemoryConversationsRepository extends ConversationsRepositoryPort {
  readonly conversations: Conversation[] = [];
  readonly messages: ConversationMessage[] = [];

  async findByUserAndExpert(
    userId: string,
    expertId: string,
  ): Promise<Conversation | null> {
    return (
      this.conversations.find(
        (conversation) =>
          conversation.userId === userId && conversation.expertId === expertId,
      ) ?? null
    );
  }

  async create(userId: string, expertId: string): Promise<Conversation> {
    const existing = await this.findByUserAndExpert(userId, expertId);

    if (existing !== null) {
      return existing;
    }

    const conversation: Conversation = {
      id: randomUUID(),
      userId,
      expertId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.conversations.push(conversation);

    return conversation;
  }

  async listMessages(
    conversationId: string,
    userId: string,
  ): Promise<ConversationMessage[]> {
    const owned = this.conversations.find(
      (conversation) =>
        conversation.id === conversationId && conversation.userId === userId,
    );

    if (owned === undefined) {
      return [];
    }

    return this.messages.filter(
      (message) => message.conversationId === conversationId,
    );
  }

  async appendExchange(
    conversationId: string,
    userId: string,
    exchange: NewExchange,
  ): Promise<PersistedExchange> {
    const owned = this.conversations.find(
      (conversation) =>
        conversation.id === conversationId && conversation.userId === userId,
    );

    if (owned === undefined) {
      throw new Error("conversation is not owned by the user");
    }

    const userMessage: ConversationMessage = {
      id: randomUUID(),
      conversationId,
      role: "user",
      content: exchange.userContent,
      createdAt: new Date(),
    };
    const expertMessage: ConversationMessage = {
      id: randomUUID(),
      conversationId,
      role: "expert",
      content: exchange.expertContent,
      createdAt: new Date(Date.now() + 1),
      ...(exchange.citations === undefined
        ? {}
        : { citations: exchange.citations }),
      ...(exchange.retrieval === undefined
        ? {}
        : { retrieval: exchange.retrieval }),
      ...(exchange.answerStatus === undefined
        ? {}
        : { answerStatus: exchange.answerStatus }),
      ...(exchange.media === undefined ? {} : { media: exchange.media }),
    };

    this.messages.push(userMessage, expertMessage);

    return { userMessage, expertMessage };
  }
}
