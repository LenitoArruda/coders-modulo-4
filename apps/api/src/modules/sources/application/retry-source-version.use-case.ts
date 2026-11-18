import { Inject, Injectable } from "@nestjs/common";

import { SourcesRepositoryPort } from "./ports/sources-repository.port";
import { VectorStorePort } from "./ports/vector-store.port";
import { ProcessSourceVersionUseCase } from "./process-source-version.use-case";
import { SourceVersionNotFoundError } from "../domain/source.errors";

export type RetrySourceVersionResult = {
  sourceId: string;
  versionId: string;
  status: "processing";
};

/** Retries a failed version after clearing any partial vector write. */
@Injectable()
export class RetrySourceVersionUseCase {
  constructor(
    @Inject(SourcesRepositoryPort)
    private readonly sources: SourcesRepositoryPort,
    @Inject(VectorStorePort) private readonly vectors: VectorStorePort,
    @Inject(ProcessSourceVersionUseCase)
    private readonly processVersion: ProcessSourceVersionUseCase,
  ) {}

  async execute(
    userId: string,
    versionId: string,
  ): Promise<RetrySourceVersionResult> {
    const version = await this.sources.findVersion(userId, versionId);

    if (version === null || version.status !== "failed") {
      throw new SourceVersionNotFoundError();
    }

    await this.vectors.deleteVersion(userId, versionId);
    await this.sources.updateVersionStatus(
      userId,
      versionId,
      "processing",
      undefined,
      null,
    );
    await this.processVersion.execute({ userId, versionId });

    return {
      sourceId: version.sourceId,
      versionId,
      status: "processing",
    };
  }
}
