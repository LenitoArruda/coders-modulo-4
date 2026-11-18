import { Inject, Injectable } from "@nestjs/common";

import { SourcesRepositoryPort } from "./ports/sources-repository.port";
import type { SourceSummary } from "../domain/source";

export type ListSourcesResult = { sources: SourceSummary[] };

/** Lists only the authenticated user's connected sources. */
@Injectable()
export class ListSourcesUseCase {
  constructor(
    @Inject(SourcesRepositoryPort)
    private readonly sources: SourcesRepositoryPort,
  ) {}

  async execute(userId: string): Promise<ListSourcesResult> {
    return { sources: await this.sources.listSources(userId) };
  }
}
