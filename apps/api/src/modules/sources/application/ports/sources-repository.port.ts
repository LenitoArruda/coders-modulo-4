import type {
  Chunk,
  NewSourceVersion,
  Source,
  SourceStatus,
  SourceSummary,
  SourceVersion,
} from "../../domain/source";

/** Persistence boundary for sources. All reads and writes are user-scoped. */
export abstract class SourcesRepositoryPort {
  abstract findVersionByHash(
    userId: string,
    contentHash: string,
  ): Promise<SourceVersion | null>;

  abstract findSourceByNormalizedName(
    userId: string,
    normalizedName: string,
  ): Promise<Source | null>;

  abstract createSource(
    userId: string,
    name: string,
    normalizedName: string,
    type: SourceVersion["type"],
  ): Promise<Source>;

  /** Returns null when a concurrent request already linked the same hash. */
  abstract createVersion(
    input: NewSourceVersion & { userId: string },
  ): Promise<SourceVersion | null>;

  abstract findVersion(
    userId: string,
    versionId: string,
  ): Promise<SourceVersion | null>;

  abstract saveFile(
    userId: string,
    versionId: string,
    content: Buffer,
  ): Promise<void>;

  abstract findFile(userId: string, versionId: string): Promise<Buffer | null>;

  abstract saveChunks(chunks: Chunk[]): Promise<void>;

  abstract updateVersionStatus(
    userId: string,
    versionId: string,
    status: SourceStatus,
    chunkCount?: number,
    errorMessage?: string | null,
  ): Promise<void>;

  abstract activateVersion(
    userId: string,
    sourceId: string,
    versionId: string,
  ): Promise<void>;

  abstract listSources(userId: string): Promise<SourceSummary[]>;

  /** Returns the source and its version ids, or null when it is not owned. */
  abstract findForDeletion(
    userId: string,
    sourceId: string,
  ): Promise<{ sourceId: string; versionIds: string[] } | null>;

  abstract deleteSource(userId: string, sourceId: string): Promise<boolean>;
}
