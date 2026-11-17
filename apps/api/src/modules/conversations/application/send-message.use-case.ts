import { Inject, Injectable } from "@nestjs/common";

import { getExpertById } from "../../experts/domain/expert-catalog";
import {
  ModelUnavailableError,
  UnknownExpertError,
} from "../domain/conversation.errors";
import type { ConversationMessage, PromptSource } from "../domain/conversation";
import { log } from "../../shared/observability/app-logger";

import { ConversationsRepositoryPort } from "./ports/conversations-repository.port";
import { ExpertResponderPort } from "./ports/expert-responder.port";

export type SendMessageInput = {
  userId: string;
  expertId: string;
  prompt: string;
  source: PromptSource;
};

export type SendMessageResult = {
  conversationId: string;
  userMessage: ConversationMessage;
  expertMessage: ConversationMessage;
};

/**
 * Validates the Expert, asks the model and persists both sides of the exchange.
 * A model failure happens before persistence, so no partial reply is stored.
 * Telemetry carries identifiers, duration and outcome only — never the prompt
 * or the response.
 */
@Injectable()
export class SendMessageUseCase {
  constructor(
    @Inject(ConversationsRepositoryPort)
    private readonly conversations: ConversationsRepositoryPort,
    @Inject(ExpertResponderPort)
    private readonly responder: ExpertResponderPort,
  ) {}

  async execute(input: SendMessageInput): Promise<SendMessageResult> {
    const startedAt = Date.now();
    const expert = getExpertById(input.expertId);

    if (expert === null) {
      throw new UnknownExpertError(input.expertId);
    }

    log("info", "expert.chat", {
      event: "prompt.submitted",
      expertId: expert.id,
      userId: input.userId,
      source: input.source,
      outcome: "accepted",
    });

    if (input.source === "suggestion") {
      log("info", "expert.chat", {
        event: "suggestion.clicked",
        expertId: expert.id,
        userId: input.userId,
        outcome: "ok",
      });
    }

    // Look up the conversation but do not create one until the model replies.
    // A failed response must leave no persisted trace.
    const existingConversation = await this.conversations.findByUserAndExpert(
      input.userId,
      expert.id,
    );

    let reply: string;

    try {
      reply = await this.responder.respond(expert, input.prompt);
    } catch (error) {
      log("warn", "expert.chat", {
        event: "response.failed",
        expertId: expert.id,
        userId: input.userId,
        conversationId: existingConversation?.id,
        durationMs: Date.now() - startedAt,
        outcome: "model_unavailable",
        error: error instanceof Error ? error.name : "unknown",
      });

      if (error instanceof ModelUnavailableError) {
        throw error;
      }

      throw new ModelUnavailableError(error);
    }

    const conversation =
      existingConversation ??
      (await this.conversations.create(input.userId, expert.id));

    const exchange = await this.conversations.appendExchange(
      conversation.id,
      input.userId,
      { userContent: input.prompt, expertContent: reply },
    );

    log("info", "expert.chat", {
      event: "response.completed",
      expertId: expert.id,
      userId: input.userId,
      conversationId: conversation.id,
      messageId: exchange.expertMessage.id,
      durationMs: Date.now() - startedAt,
      outcome: "ok",
    });

    return {
      conversationId: conversation.id,
      userMessage: exchange.userMessage,
      expertMessage: exchange.expertMessage,
    };
  }
}
