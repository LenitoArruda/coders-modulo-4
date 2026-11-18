export type CitationSourceRef = {
  sourceId: string;
  sourceVersionId: string;
};

export type CitationSourceMetadata = {
  sourceName: string;
  sourceType: string;
  isStale: boolean;
  sourceRemoved: boolean;
};

/**
 * Loads current source/version state for citations. User-scoped so a stale or
 * removed source from another account can never be observed.
 */
export abstract class CitationSourceMetadataPort {
  abstract load(
    userId: string,
    refs: CitationSourceRef[],
  ): Promise<Map<string, CitationSourceMetadata>>;
}
