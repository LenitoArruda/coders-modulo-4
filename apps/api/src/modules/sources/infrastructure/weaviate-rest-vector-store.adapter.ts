import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";

import {
  VectorStorePort,
  type VectorRecord,
} from "../application/ports/vector-store.port";
import { SourceVectorStoreError } from "../domain/source.errors";
import { SOURCE_WEAVIATE_URL } from "../sources.tokens";

const COLLECTION = "KnowledgeChunk";
const REQUEST_TIMEOUT_MS = 10_000;

type GraphQLResponse = {
  data?: { Get?: { KnowledgeChunk?: { _additional?: { id?: string } }[] } };
  errors?: unknown[];
};

/** Stable Weaviate object id so a retry cannot create duplicate vectors. */
function vectorObjectId(chunkId: string): string {
  const bytes = createHash("sha256").update(chunkId).digest().subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString("hex");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Weaviate adapter using only the HTTP API exposed by the local Compose stack.
 * The official v3 client would also need gRPC 50051, which is not published.
 */
@Injectable()
export class WeaviateRestVectorStoreAdapter extends VectorStorePort {
  constructor(@Inject(SOURCE_WEAVIATE_URL) private readonly url: string) {
    super();
  }

  async ensureCollection(): Promise<void> {
    const existing = await this.request(
      `${this.baseUrl()}/v1/schema/${COLLECTION}`,
      {
        method: "GET",
      },
    );

    if (existing.status === 200) return;
    if (existing.status !== 404) throw new SourceVectorStoreError();

    const created = await this.request(`${this.baseUrl()}/v1/schema`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        class: COLLECTION,
        vectorizer: "none",
        vectorIndexType: "hnsw",
        vectorIndexConfig: { distance: "cosine" },
        properties: [
          this.property("userId"),
          this.property("sourceId"),
          this.property("sourceVersionId"),
          this.property("chunkId"),
          { name: "chunkIndex", dataType: ["int"] },
          this.property("content"),
        ],
      }),
    });

    if (!created.ok) throw new SourceVectorStoreError();
  }

  async upsert(userId: string, records: VectorRecord[]): Promise<void> {
    for (const record of records) {
      const response = await this.request(`${this.baseUrl()}/v1/objects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class: COLLECTION,
          id: vectorObjectId(record.chunk.id),
          vector: record.vector,
          properties: {
            userId,
            sourceId: record.chunk.sourceId,
            sourceVersionId: record.chunk.sourceVersionId,
            chunkId: record.chunk.id,
            chunkIndex: record.chunk.index,
            content: record.chunk.content,
          },
        }),
      });

      if (!response.ok) throw new SourceVectorStoreError();
    }
  }

  async deleteSource(userId: string, sourceId: string): Promise<void> {
    await this.deleteBy(userId, "sourceId", sourceId);
  }

  async deleteVersion(userId: string, versionId: string): Promise<void> {
    await this.deleteBy(userId, "sourceVersionId", versionId);
  }

  private property(name: string) {
    return {
      name,
      dataType: ["text"],
      indexFilterable: true,
      indexSearchable: false,
    };
  }

  private baseUrl(): string {
    return this.url.trim().replace(/\/+$/, "");
  }

  private async deleteBy(
    userId: string,
    path: string,
    value: string,
  ): Promise<void> {
    const query = `{ Get { ${COLLECTION}(where: { operator: And, operands: [
      { path: ["${path}"], operator: Equal, valueText: ${JSON.stringify(value)} },
      { path: ["userId"], operator: Equal, valueText: ${JSON.stringify(userId)} }
    ] }) { _additional { id } } } }`;
    const response = await this.request(`${this.baseUrl()}/v1/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) throw new SourceVectorStoreError();

    const body = (await response
      .json()
      .catch(() => null)) as GraphQLResponse | null;
    const records = body?.data?.Get?.[COLLECTION];

    if (body?.errors !== undefined || !Array.isArray(records)) {
      throw new SourceVectorStoreError();
    }

    for (const record of records) {
      const id = record._additional?.id;

      if (typeof id !== "string") throw new SourceVectorStoreError();

      const deleted = await this.request(
        `${this.baseUrl()}/v1/objects/${COLLECTION}/${id}`,
        { method: "DELETE" },
      );

      if (!deleted.ok) throw new SourceVectorStoreError();
    }
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new SourceVectorStoreError();
    }
  }
}
