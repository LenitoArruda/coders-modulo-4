import { randomUUID } from "node:crypto";

import { SourcesRepositoryPort } from "../../modules/sources/application/ports/sources-repository.port";
import type {
  Chunk,
  NewSourceVersion,
  Source,
  SourceStatus,
  SourceSummary,
  SourceVersion,
} from "../../modules/sources/domain/source";

type StoredFile = { userId: string; versionId: string; content: Buffer };
type StoredVersion = SourceVersion & { createdOrder: number };

/** Hermetic repository used by use-case and HTTP integration tests. */
export class InMemorySourcesRepository extends SourcesRepositoryPort {
  readonly sources: Source[] = [];
  readonly versions: StoredVersion[] = [];
  readonly files: StoredFile[] = [];
  readonly chunks: Chunk[] = [];

  private order = 0;

  async findVersionByHash(
    userId: string,
    contentHash: string,
  ): Promise<SourceVersion | null> {
    return (
      this.versions
        .filter(
          (version) =>
            version.userId === userId &&
            version.contentHash === contentHash &&
            version.status !== "failed",
        )
        .sort((a, b) => b.createdOrder - a.createdOrder)[0] ?? null
    );
  }

  async findSourceByNormalizedName(
    userId: string,
    normalizedName: string,
  ): Promise<Source | null> {
    return (
      this.sources.find(
        (source) =>
          source.userId === userId && source.normalizedName === normalizedName,
      ) ?? null
    );
  }

  async createSource(
    userId: string,
    name: string,
    normalizedName: string,
    type: SourceVersion["type"],
  ): Promise<Source> {
    const existing = await this.findSourceByNormalizedName(
      userId,
      normalizedName,
    );

    if (existing !== null) return existing;

    // Re-check without yielding so concurrent uploads cannot create two sources.
    const concurrent = this.sources.find(
      (candidate) =>
        candidate.userId === userId &&
        candidate.normalizedName === normalizedName,
    );

    if (concurrent !== undefined) return concurrent;

    const now = new Date();
    const source: Source = {
      id: randomUUID(),
      userId,
      name,
      normalizedName,
      type,
      currentVersionId: null,
      createdAt: now,
      updatedAt: now,
    };
    this.sources.push(source);

    return source;
  }

  async createVersion(
    input: NewSourceVersion & { userId: string },
  ): Promise<SourceVersion | null> {
    if (
      this.versions.some(
        (version) =>
          version.userId === input.userId &&
          version.contentHash === input.contentHash &&
          version.status !== "failed",
      )
    ) {
      return null;
    }

    const now = new Date();
    this.order += 1;
    const version: StoredVersion = {
      ...input,
      id: randomUUID(),
      chunkCount: 0,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
      createdOrder: this.order,
    };
    this.versions.push(version);

    return version;
  }

  async findVersion(
    userId: string,
    versionId: string,
  ): Promise<SourceVersion | null> {
    return (
      this.versions.find(
        (version) => version.userId === userId && version.id === versionId,
      ) ?? null
    );
  }

  async saveFile(
    userId: string,
    versionId: string,
    content: Buffer,
  ): Promise<void> {
    const stored = this.files.find(
      (file) => file.userId === userId && file.versionId === versionId,
    );

    if (stored !== undefined) {
      stored.content = content;
      return;
    }

    this.files.push({ userId, versionId, content });
  }

  async findFile(userId: string, versionId: string): Promise<Buffer | null> {
    return (
      this.files.find(
        (file) => file.userId === userId && file.versionId === versionId,
      )?.content ?? null
    );
  }

  async saveChunks(chunks: Chunk[]): Promise<void> {
    for (const chunk of chunks) {
      const existing = this.chunks.findIndex(
        (candidate) =>
          candidate.userId === chunk.userId &&
          candidate.sourceVersionId === chunk.sourceVersionId &&
          candidate.index === chunk.index,
      );

      if (existing >= 0) this.chunks[existing] = chunk;
      else this.chunks.push(chunk);
    }
  }

  async updateVersionStatus(
    userId: string,
    versionId: string,
    status: SourceStatus,
    chunkCount?: number,
    errorMessage?: string | null,
  ): Promise<void> {
    const version = await this.findVersion(userId, versionId);

    if (version === null) return;

    version.status = status;
    if (chunkCount !== undefined) version.chunkCount = chunkCount;
    version.errorMessage = errorMessage ?? null;
    version.updatedAt = new Date();
  }

  async activateVersion(
    userId: string,
    sourceId: string,
    versionId: string,
  ): Promise<void> {
    const source = this.sources.find(
      (candidate) => candidate.id === sourceId && candidate.userId === userId,
    );

    if (source !== undefined) {
      source.currentVersionId = versionId;
      source.updatedAt = new Date();
    }
  }

  async listSources(userId: string): Promise<SourceSummary[]> {
    return this.sources
      .filter((source) => source.userId === userId)
      .map((source) => {
        const sourceVersions = this.versions
          .filter((version) => version.sourceId === source.id)
          .sort((a, b) => a.createdOrder - b.createdOrder);
        const version =
          sourceVersions.find(
            (candidate) => candidate.id === source.currentVersionId,
          ) ?? sourceVersions[sourceVersions.length - 1];

        if (version === undefined) {
          throw new Error("source without version");
        }

        return {
          id: source.id,
          name: source.name,
          type: source.type,
          byteSize: version.byteSize,
          status: version.status,
          versionId: version.id,
          versionNumber: sourceVersions.indexOf(version) + 1,
          chunkCount: version.chunkCount,
          isStale: false,
          createdAt: source.createdAt,
        };
      });
  }

  async findForDeletion(
    userId: string,
    sourceId: string,
  ): Promise<{ sourceId: string; versionIds: string[] } | null> {
    const source = this.sources.find(
      (candidate) => candidate.id === sourceId && candidate.userId === userId,
    );

    if (source === undefined) return null;

    return {
      sourceId: source.id,
      versionIds: this.versions
        .filter((version) => version.sourceId === source.id)
        .map((version) => version.id),
    };
  }

  async deleteSource(userId: string, sourceId: string): Promise<boolean> {
    const index = this.sources.findIndex(
      (source) => source.id === sourceId && source.userId === userId,
    );

    if (index < 0) return false;

    const [source] = this.sources.splice(index, 1);
    const versionIds = this.versions
      .filter(
        (version) => version.sourceId === sourceId && version.userId === userId,
      )
      .map((version) => version.id);

    for (
      let position = this.versions.length - 1;
      position >= 0;
      position -= 1
    ) {
      if (versionIds.includes(this.versions[position]?.id ?? "")) {
        this.versions.splice(position, 1);
      }
    }

    for (let position = this.files.length - 1; position >= 0; position -= 1) {
      if (versionIds.includes(this.files[position]?.versionId ?? "")) {
        this.files.splice(position, 1);
      }
    }

    for (let position = this.chunks.length - 1; position >= 0; position -= 1) {
      if (versionIds.includes(this.chunks[position]?.sourceVersionId ?? "")) {
        this.chunks.splice(position, 1);
      }
    }

    return source !== undefined;
  }
}
