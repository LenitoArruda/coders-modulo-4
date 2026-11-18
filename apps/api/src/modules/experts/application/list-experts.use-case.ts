import { Injectable } from "@nestjs/common";

import { EXPERT_CATALOG } from "../domain/expert-catalog";
import type { Expert } from "../domain/expert";

export type ExpertListResponse = {
  experts: Expert[];
};

/** Returns the immutable catalog in product display order. */
@Injectable()
export class ListExpertsUseCase {
  execute(): ExpertListResponse {
    return { experts: [...EXPERT_CATALOG] };
  }
}
