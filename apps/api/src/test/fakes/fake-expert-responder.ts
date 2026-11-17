import type { Expert } from "../../modules/experts/domain/expert";
import { ExpertResponderPort } from "../../modules/conversations/application/ports/expert-responder.port";

/** Deterministic responder: no external model call in tests. */
export class FakeExpertResponder extends ExpertResponderPort {
  readonly calls: Array<{ expertId: string; prompt: string }> = [];
  failWith: Error | null = null;

  async respond(expert: Expert, prompt: string): Promise<string> {
    this.calls.push({ expertId: expert.id, prompt });

    if (this.failWith !== null) {
      throw this.failWith;
    }

    return `As the ${expert.name}, here is a focused answer.`;
  }
}
