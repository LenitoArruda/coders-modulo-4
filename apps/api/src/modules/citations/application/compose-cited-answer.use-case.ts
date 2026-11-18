import { Injectable } from "@nestjs/common";

import { log } from "../../shared/observability/app-logger";
import type { GroundedAnswer, GroundingContext } from "../domain/citation";
import { sanitizeGroundedAnswer } from "../domain/citation-policy";

/** Validates model output against the injected snippets before persistence. */
@Injectable()
export class ComposeCitedAnswerUseCase {
  execute(answer: string, context: GroundingContext): GroundedAnswer {
    const result = sanitizeGroundedAnswer(answer, context);

    if (result.invalidCitationNumbers.length > 0) {
      log("warn", "rag", {
        event: "rag.citation.invalid",
        count: result.invalidCitationNumbers.length,
        outcome: "sanitized",
      });
    }

    return result;
  }
}
