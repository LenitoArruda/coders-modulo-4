import { Injectable } from "@nestjs/common";

import { log } from "../../shared/observability/app-logger";
import type { Citation } from "../domain/citation";

import { CitationSourceMetadataPort } from "./ports/citation-source-metadata.port";

/**
 * Recomputes stale/removed state when a transcript is read. A metadata failure
 * keeps the stored snapshot so the history stays readable.
 */
@Injectable()
export class RefreshCitationsUseCase {
  constructor(private readonly sources: CitationSourceMetadataPort) {}

  async execute(userId: string, citations: Citation[]): Promise<Citation[]> {
    if (citations.length === 0) return citations;

    try {
      const metadata = await this.sources.load(
        userId,
        citations.map((citation) => ({
          sourceId: citation.sourceId,
          sourceVersionId: citation.sourceVersionId,
        })),
      );

      return citations.map((citation) => {
        const current = metadata.get(citation.sourceVersionId);

        if (current === undefined) return citation;

        return {
          ...citation,
          sourceName: current.sourceName,
          sourceType: current.sourceType,
          isStale: current.isStale,
          sourceRemoved: current.sourceRemoved,
        };
      });
    } catch (error) {
      log("warn", "rag", {
        event: "rag.citation.refresh_failed",
        userId,
        count: citations.length,
        error: error instanceof Error ? error.name : "unknown",
      });

      return citations;
    }
  }
}
