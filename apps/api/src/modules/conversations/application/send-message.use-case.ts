import { Inject, Injectable, Optional } from "@nestjs/common";

import { ComposeCitedAnswerUseCase } from "../../citations/application/compose-cited-answer.use-case";
import { RetrieveContextUseCase } from "../../citations/application/retrieve-context.use-case";
import {
  RAG_CITATIONS_ENABLED,
  RAG_MAX_CONTEXT_CHARS,
  RAG_MAX_HISTORY_MESSAGES,
  RAG_THRESHOLD,
  RAG_TOP_K,
} from "../../citations/citations.tokens";
import type {
  GroundedAnswer,
  GroundingContext,
} from "../../citations/domain/citation";
import { RequestMediaGenerationUseCase } from "../../media/application/request-media-generation.use-case";
import { MediaGenerationRepositoryPort } from "../../media/application/ports/media-generation-repository.port";
import type { MediaAttachment } from "../../media/domain/media";
import { MEDIA_ENABLED } from "../../media/media.tokens";
import {
  DEFAULT_RAG_MAX_CONTEXT_CHARS,
  DEFAULT_RAG_MAX_HISTORY_MESSAGES,
  DEFAULT_RAG_THRESHOLD,
  DEFAULT_RAG_TOP_K,
} from "../../shared/config/env";
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
 * Validates the Expert, optionally grounds the answer in the user's connected
 * knowledge, asks the model and persists both sides of the exchange. A model
 * failure happens before persistence, so no partial reply is stored. Telemetry
 * carries identifiers, duration and outcome only — never prompt or response.
 */
@Injectable()
export class SendMessageUseCase {
  constructor(
    @Inject(ConversationsRepositoryPort)
    private readonly conversations: ConversationsRepositoryPort,
    @Inject(ExpertResponderPort)
    private readonly responder: ExpertResponderPort,
    @Optional()
    @Inject(RAG_CITATIONS_ENABLED)
    private readonly ragEnabled: boolean = false,
    @Optional()
    @Inject(RetrieveContextUseCase)
    private readonly retrieveContext: RetrieveContextUseCase | null = null,
    @Optional()
    @Inject(ComposeCitedAnswerUseCase)
    private readonly composeAnswer: ComposeCitedAnswerUseCase | null = null,
    @Optional()
    @Inject(RAG_TOP_K)
    private readonly topK: number = DEFAULT_RAG_TOP_K,
    @Optional()
    @Inject(RAG_THRESHOLD)
    private readonly threshold: number = DEFAULT_RAG_THRESHOLD,
    @Optional()
    @Inject(RAG_MAX_CONTEXT_CHARS)
    private readonly maxContextChars: number = DEFAULT_RAG_MAX_CONTEXT_CHARS,
    @Optional()
    @Inject(RAG_MAX_HISTORY_MESSAGES)
    private readonly maxHistoryMessages: number = DEFAULT_RAG_MAX_HISTORY_MESSAGES,
    @Optional()
    @Inject(MEDIA_ENABLED)
    private readonly mediaEnabled: boolean = false,
    @Optional()
    @Inject(RequestMediaGenerationUseCase)
    private readonly requestMedia: RequestMediaGenerationUseCase | null = null,
    @Optional()
    @Inject(MediaGenerationRepositoryPort)
    private readonly mediaRepository: MediaGenerationRepositoryPort | null = null,
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

    const needsTranscript =
      existingConversation !== null && (this.mediaEnabled || this.ragEnabled);
    const transcript: ConversationMessage[] = needsTranscript
      ? await this.conversations.listMessages(
          existingConversation!.id,
          input.userId,
        )
      : [];

    const mediaResult =
      this.mediaEnabled && this.requestMedia !== null
        ? await this.requestMedia.execute({
            userId: input.userId,
            expertId: expert.id,
            expertName: expert.name,
            expertTone: expert.tone,
            prompt: input.prompt,
            citations:
              [...transcript]
                .reverse()
                .find((message) => message.role === "expert")?.citations ?? [],
          })
        : null;
    const mediaAttachments: MediaAttachment[] =
      mediaResult?.outcome === "queued" ? [mediaResult.attachment] : [];

    const retriever = this.retrieveContext;
    const canRetrieve = this.ragEnabled && retriever !== null;
    const grounding: GroundingContext | null =
      canRetrieve && retriever !== null
        ? await retriever.execute({
            userId: input.userId,
            prompt: input.prompt,
            topK: this.topK,
            threshold: this.threshold,
            maxContextChars: this.maxContextChars,
          })
        : null;
    const history: ConversationMessage[] =
      grounding !== null && existingConversation !== null
        ? transcript.slice(-this.maxHistoryMessages)
        : [];

    let reply: string;
    let groundedAnswer: GroundedAnswer | null = null;

    if (mediaResult !== null && mediaResult.outcome !== "none") {
      reply =
        mediaResult.outcome === "text"
          ? mediaResult.message
          : mediaResult.reply;
      log("info", "expert.chat", {
        event: "response.completed",
        expertId: expert.id,
        userId: input.userId,
        conversationId: existingConversation?.id,
        durationMs: Date.now() - startedAt,
        outcome: mediaResult.outcome,
      });
    } else
      try {
        reply = await this.responder.respond(
          expert,
          input.prompt,
          grounding,
          history,
        );

        if (grounding !== null) {
          const composer =
            this.composeAnswer ?? new ComposeCitedAnswerUseCase();

          groundedAnswer = composer.execute(reply, grounding);
          reply = groundedAnswer.content;
        }
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
      {
        userContent: input.prompt,
        expertContent: reply,
        ...(groundedAnswer === null
          ? {}
          : {
              citations: groundedAnswer.citations,
              retrieval: groundedAnswer.retrieval,
              answerStatus: groundedAnswer.answerStatus,
            }),
        ...(mediaAttachments.length === 0 ? {} : { media: mediaAttachments }),
      },
    );

    if (mediaResult?.outcome === "queued" && this.mediaRepository !== null) {
      await this.mediaRepository.linkMessage(
        mediaResult.attachment.mediaId,
        exchange.expertMessage.id,
        conversation.id,
        input.userId,
      );
    }

    log("info", "expert.chat", {
      event: "response.completed",
      expertId: expert.id,
      userId: input.userId,
      conversationId: conversation.id,
      messageId: exchange.expertMessage.id,
      durationMs: Date.now() - startedAt,
      outcome: groundedAnswer === null ? "ok" : groundedAnswer.answerStatus,
    });

    return {
      conversationId: conversation.id,
      userMessage: exchange.userMessage,
      expertMessage: exchange.expertMessage,
    };
  }
}
