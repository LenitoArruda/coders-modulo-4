import type { GroundingContext } from "../../../citations/domain/citation";
import type { TraceCorrelation } from "../../../observability/domain/trace-span";
import type { ConversationMessage } from "../../domain/conversation";
import type { Expert } from "../../../experts/domain/expert";

/** Boundary around the model call. The adapter owns LangChain and LangGraph. */
export abstract class ExpertResponderPort {
  /**
   * Returns the Expert's reply text for an already validated prompt. Grounding
   * and recent history are optional so the fatia 1 chat keeps working unchanged.
   */
  abstract respond(
    expert: Expert,
    prompt: string,
    grounding?: GroundingContext | null,
    history?: ConversationMessage[],
    trace?: TraceCorrelation | null,
  ): Promise<string>;
}
