import {
  BadRequestException,
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Inject,
  NotFoundException,
  Post,
  UseGuards,
} from "@nestjs/common";

import { AuthUser } from "../../../auth/domain/auth-user";
import { CurrentUser } from "../../../auth/interface/current-user.decorator";
import { SessionGuard } from "../../../auth/interface/session.guard";
import {
  SendMessageUseCase,
  type SendMessageResult,
} from "../../application/send-message.use-case";
import {
  ModelUnavailableError,
  UnknownExpertError,
} from "../../domain/conversation.errors";
import { validateSendMessageInput } from "../../domain/send-message-input";
import { EXPERT_PROMPT_MAX_LENGTH } from "../../conversations.tokens";

export const INVALID_MESSAGE_MESSAGE = "Check your message and try again.";
export const MODEL_UNAVAILABLE_MESSAGE =
  "The Expert could not respond right now. Try again in a moment.";
export const UNKNOWN_EXPERT_MESSAGE = "That Expert is not available.";

/** Sends a prompt to the selected Expert and persists the exchange. */
@Controller("conversations")
export class SendMessageRequestHandler {
  constructor(
    @Inject(SendMessageUseCase)
    private readonly sendMessage: SendMessageUseCase,
    @Inject(EXPERT_PROMPT_MAX_LENGTH)
    private readonly promptMaxLength: number,
  ) {}

  @Post("messages")
  @UseGuards(SessionGuard)
  async handle(
    @CurrentUser() user: AuthUser,
    @Body() body: unknown,
  ): Promise<SendMessageResult> {
    const validation = validateSendMessageInput(body, this.promptMaxLength);

    if (!validation.ok) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: INVALID_MESSAGE_MESSAGE,
        fieldErrors: validation.fieldErrors,
      });
    }

    try {
      return await this.sendMessage.execute({
        ...validation.value,
        userId: user.id,
      });
    } catch (error) {
      if (error instanceof UnknownExpertError) {
        throw new NotFoundException({
          code: "UNKNOWN_EXPERT",
          message: UNKNOWN_EXPERT_MESSAGE,
        });
      }

      if (error instanceof ModelUnavailableError) {
        throw new HttpException(
          { code: "MODEL_UNAVAILABLE", message: MODEL_UNAVAILABLE_MESSAGE },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      throw error;
    }
  }
}
