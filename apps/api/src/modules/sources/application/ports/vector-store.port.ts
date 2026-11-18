import type { Chunk } from "../../domain/source";

export type VectorRecord = {
  chunk: Chunk;
  vector: number[];
};

/** Weaviate boundary. Every filter includes the owning user id. */
export abstract class VectorStorePort {
  abstract ensureCollection(): Promise<void>;

  abstract upsert(userId: string, records: VectorRecord[]): Promise<void>;

  abstract deleteSource(userId: string, sourceId: string): Promise<void>;

  abstract deleteVersion(userId: string, versionId: string): Promise<void>;
}
