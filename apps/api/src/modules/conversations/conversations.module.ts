import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { CitationsModule } from "../citations/citations.module";
import { MediaModule } from "../media/media.module";
import { ObservabilityModule } from "../observability/observability.module";
import { loadEnv } from "../shared/config/env";

import {
  EXPERT_PROMPT_MAX_LENGTH,
  OPENAI_API_KEY,
} from "./conversations.tokens";
import { GetConversationUseCase } from "./application/get-conversation.use-case";
import { ConversationsRepositoryPort } from "./application/ports/conversations-repository.port";
import { ExpertResponderPort } from "./application/ports/expert-responder.port";
import { SendMessageUseCase } from "./application/send-message.use-case";
import { LangGraphExpertResponder } from "./infrastructure/langgraph-expert.responder";
import { PostgresConversationsRepository } from "./infrastructure/postgres-conversations.repository";
import { GetConversationRequestHandler } from "./interface/request-handlers/get-conversation.request-handler";
import { SendMessageRequestHandler } from "./interface/request-handlers/send-message.request-handler";

/**
 * Chat vertical slice. Configuration is read lazily so importing the module
 * never requires the optional OpenAI key to be present.
 */
@Module({
  imports: [AuthModule, CitationsModule, MediaModule, ObservabilityModule],
  controllers: [GetConversationRequestHandler, SendMessageRequestHandler],
  providers: [
    { provide: OPENAI_API_KEY, useFactory: () => loadEnv().openaiApiKey },
    {
      provide: EXPERT_PROMPT_MAX_LENGTH,
      useFactory: () => loadEnv().expertPromptMaxLength,
    },
    {
      provide: ConversationsRepositoryPort,
      useClass: PostgresConversationsRepository,
    },
    { provide: ExpertResponderPort, useClass: LangGraphExpertResponder },
    GetConversationUseCase,
    SendMessageUseCase,
  ],
})
export class ConversationsModule {}
