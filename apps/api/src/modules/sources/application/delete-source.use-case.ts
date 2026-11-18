import { Inject, Injectable } from "@nestjs/common";

import { log } from "../../shared/observability/app-logger";
import { SourcesRepositoryPort } from "./ports/sources-repository.port";
import { VectorStorePort } from "./ports/vector-store.port";
import { SourceNotFoundError } from "../domain/source.errors";

export type DeleteSourceResult = { id: string; deleted: true };

/** Removes vectors first, then the file, versions and chunks in PostgreSQL. */
@Injectable()
export class DeleteSourceUseCase {
  constructor(
    @Inject(SourcesRepositoryPort)
    private readonly sources: SourcesRepositoryPort,
    @Inject(VectorStorePort) private readonly vectors: VectorStorePort,
  ) {}

  async execute(userId: string, sourceId: string): Promise<DeleteSourceResult> {
    const found = await this.sources.findForDeletion(userId, sourceId);

    if (found === null) throw new SourceNotFoundError();

    await this.vectors.deleteSource(userId, sourceId);
    const deleted = await this.sources.deleteSource(userId, sourceId);

    if (!deleted) throw new SourceNotFoundError();

    log("info", "knowledge.sources", {
      event: "source.deleted",
      outcome: "ok",
      userId,
      sourceId,
      versionCount: found.versionIds.length,
    });

    return { id: sourceId, deleted: true };
  }
}
