import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Query,
  UseGuards,
} from "@nestjs/common";

import type { AuthUser } from "../../../auth/domain/auth-user";
import { CurrentUser } from "../../../auth/interface/current-user.decorator";
import { SessionGuard } from "../../../auth/interface/session.guard";
import {
  GetConversationUseCase,
  type GetConversationResult,
} from "../../application/get-conversation.use-case";
import { UnknownExpertError } from "../../domain/conversation.errors";

export const INVALID_EXPERT_MESSAGE = "Choose an Expert and try again.";
export const UNKNOWN_EXPERT_MESSAGE = "That Expert is not available.";

/** Returns the transcript for the selected Expert. */
@Controller("conversations")
export class GetConversationRequestHandler {
  constructor(
    @Inject(GetConversationUseCase)
    private readonly getConversation: GetConversationUseCase,
  ) {}

  @Get()
  @UseGuards(SessionGuard)
  async handle(
    @CurrentUser() user: AuthUser,
    @Query("expertId") expertId: unknown,
  ): Promise<GetConversationResult> {
    if (typeof expertId !== "string" || expertId.trim() === "") {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: INVALID_EXPERT_MESSAGE,
        fieldErrors: { expertId: INVALID_EXPERT_MESSAGE },
      });
    }

    try {
      return await this.getConversation.execute({
        userId: user.id,
        expertId: expertId.trim(),
      });
    } catch (error) {
      if (error instanceof UnknownExpertError) {
        throw new NotFoundException({
          code: "UNKNOWN_EXPERT",
          message: UNKNOWN_EXPERT_MESSAGE,
        });
      }

      throw error;
    }
  }
}
