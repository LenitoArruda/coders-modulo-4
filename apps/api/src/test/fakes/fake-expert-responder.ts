import type { Expert } from "../../modules/experts/domain/expert";
import { ExpertResponderPort } from "../../modules/conversations/application/ports/expert-responder.port";
import type { ConversationMessage } from "../../modules/conversations/domain/conversation";
import type { GroundingContext } from "../../modules/citations/domain/citation";
import type { TraceCorrelation } from "../../modules/observability/domain/trace-span";

/** Deterministic responder: no external model call in tests. */
export class FakeExpertResponder extends ExpertResponderPort {
  readonly calls: Array<{
    expertId: string;
    prompt: string;
    grounding: GroundingContext | null;
    history: ConversationMessage[];
    trace: TraceCorrelation | null;
  }> = [];
  failWith: Error | null = null;

  async respond(
    expert: Expert,
    prompt: string,
    grounding: GroundingContext | null = null,
    history: ConversationMessage[] = [],
    trace: TraceCorrelation | null = null,
  ): Promise<string> {
    this.calls.push({
      expertId: expert.id,
      prompt,
      grounding,
      history,
      trace,
    });

    if (this.failWith !== null) {
      throw this.failWith;
    }

    if (grounding?.status === "matched" && grounding.snippets.length > 0) {
      return `As the ${expert.name}, the connected sources say: [1].`;
    }

    return `As the ${expert.name}, here is a focused answer.`;
  }
}
