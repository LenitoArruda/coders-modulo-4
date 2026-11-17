import { Inject, Injectable } from "@nestjs/common";

import { getExpertById } from "../../experts/domain/expert-catalog";
import { UnknownExpertError } from "../domain/conversation.errors";
import type { ConversationMessage } from "../domain/conversation";
import { log } from "../../shared/observability/app-logger";

import { ConversationsRepositoryPort } from "./ports/conversations-repository.port";

export type GetConversationInput = {
  userId: string;
  expertId: string;
};

export type GetConversationResult = {
  conversationId: string | null;
  messages: ConversationMessage[];
};

/** Loads the transcript for one Expert, or an empty state when none exists. */
@Injectable()
export class GetConversationUseCase {
  constructor(
    @Inject(ConversationsRepositoryPort)
    private readonly conversations: ConversationsRepositoryPort,
  ) {}

  async execute(input: GetConversationInput): Promise<GetConversationResult> {
    if (getExpertById(input.expertId) === null) {
      throw new UnknownExpertError(input.expertId);
    }

    const conversation = await this.conversations.findByUserAndExpert(
      input.userId,
      input.expertId,
    );

    log("info", "expert.chat", {
      event: "expert.selected",
      expertId: input.expertId,
      userId: input.userId,
      conversationId: conversation?.id,
      outcome: "ok",
    });

    if (conversation === null) {
      return { conversationId: null, messages: [] };
    }

    const messages = await this.conversations.listMessages(
      conversation.id,
      input.userId,
    );

    return { conversationId: conversation.id, messages };
  }
}
