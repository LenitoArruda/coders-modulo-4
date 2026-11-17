import type { Expert } from "../../../experts/domain/expert";

/** Boundary around the model call. The adapter owns LangChain and LangGraph. */
export abstract class ExpertResponderPort {
  /** Returns the Expert's reply text for an already validated prompt. */
  abstract respond(expert: Expert, prompt: string): Promise<string>;
}
