import { Inject, Injectable } from "@nestjs/common";

import {
  KnowledgeRetrievalPort,
  type VectorHit,
} from "../application/ports/knowledge-retrieval.port";
import { KnowledgeRetrievalError } from "../domain/citation.errors";
import { VECTOR_INDEX } from "../domain/citation";
import { CITATION_WEAVIATE_URL } from "../citations.tokens";

const REQUEST_TIMEOUT_MS = 4_000;

type GraphQLRecord = {
  content?: unknown;
  sourceId?: unknown;
  sourceVersionId?: unknown;
  chunkId?: unknown;
  chunkIndex?: unknown;
  _additional?: { certainty?: unknown; score?: unknown };
};

type GraphQLResponse = {
  data?: { Get?: { KnowledgeChunk?: GraphQLRecord[] } };
  errors?: unknown[];
};

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function number(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * REST/GraphQL retrieval on the same `KnowledgeChunk` collection used by the
 * ingestion slice. Only user-scoped properties are read; no file paths or keys.
 */
@Injectable()
export class WeaviateRetrievalAdapter extends KnowledgeRetrievalPort {
  constructor(@Inject(CITATION_WEAVIATE_URL) private readonly url: string) {
    super();
  }

  async search(
    userId: string,
    vector: number[],
    topK: number,
  ): Promise<VectorHit[]> {
    if (userId.trim() === "" || vector.length === 0 || topK < 1) {
      throw new KnowledgeRetrievalError();
    }

    const query = `{
      Get {
        ${VECTOR_INDEX}(
          nearVector: { vector: ${JSON.stringify(vector)} }
          where: {
            operator: Equal
            path: ["userId"]
            valueText: ${JSON.stringify(userId)}
          }
          limit: ${topK}
        ) {
          content
          sourceId
          sourceVersionId
          chunkId
          chunkIndex
          _additional { certainty score }
        }
      }
    }`;

    try {
      const response = await fetch(`${this.baseUrl()}/v1/graphql`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) throw new KnowledgeRetrievalError();

      const body = (await response.json()) as GraphQLResponse;

      if (body.errors !== undefined) throw new KnowledgeRetrievalError();

      const records = body.data?.Get?.[VECTOR_INDEX];

      if (!Array.isArray(records)) throw new KnowledgeRetrievalError();

      return records.map((record) => {
        const chunkId = text(record.chunkId);
        const sourceId = text(record.sourceId);
        const sourceVersionId = text(record.sourceVersionId);
        const content = text(record.content);

        if (
          chunkId === "" ||
          sourceId === "" ||
          sourceVersionId === "" ||
          content === ""
        ) {
          throw new KnowledgeRetrievalError();
        }

        const score = number(record._additional?.certainty);

        return {
          chunkId,
          sourceId,
          sourceVersionId,
          chunkIndex: number(record.chunkIndex),
          content,
          score: score > 0 ? score : number(record._additional?.score),
        };
      });
    } catch (error) {
      if (error instanceof KnowledgeRetrievalError) throw error;

      throw new KnowledgeRetrievalError(error);
    }
  }

  private baseUrl(): string {
    return this.url.trim().replace(/\/+$/, "");
  }
}
