import {
  VectorStorePort,
  type VectorRecord,
} from "../../modules/sources/application/ports/vector-store.port";
import { SourceVectorStoreError } from "../../modules/sources/domain/source.errors";

/** In-memory Weaviate stand-in, scoped by user like the real adapter. */
export class InMemoryVectorStore extends VectorStorePort {
  failure: Error | null = null;
  readonly records: (VectorRecord & { userId: string })[] = [];
  readonly deletedSources: string[] = [];
  readonly deletedVersions: string[] = [];

  async ensureCollection(): Promise<void> {
    if (this.failure !== null) throw this.failure;
  }

  async upsert(userId: string, records: VectorRecord[]): Promise<void> {
    if (this.failure !== null) throw this.failure;

    for (const record of records) {
      const existing = this.records.findIndex(
        (candidate) =>
          candidate.userId === userId && candidate.chunk.id === record.chunk.id,
      );

      if (existing >= 0) this.records[existing] = { ...record, userId };
      else this.records.push({ ...record, userId });
    }
  }

  async deleteSource(userId: string, sourceId: string): Promise<void> {
    if (this.failure !== null) throw this.failure;

    this.deletedSources.push(sourceId);

    for (let index = this.records.length - 1; index >= 0; index -= 1) {
      const record = this.records[index];

      if (record?.userId === userId && record.chunk.sourceId === sourceId) {
        this.records.splice(index, 1);
      }
    }
  }

  async deleteVersion(userId: string, versionId: string): Promise<void> {
    this.deletedVersions.push(versionId);

    for (let index = this.records.length - 1; index >= 0; index -= 1) {
      const record = this.records[index];

      if (
        record?.userId === userId &&
        record.chunk.sourceVersionId === versionId
      ) {
        this.records.splice(index, 1);
      }
    }
  }
}

export function vectorStoreFailure(): Error {
  return new SourceVectorStoreError();
}
