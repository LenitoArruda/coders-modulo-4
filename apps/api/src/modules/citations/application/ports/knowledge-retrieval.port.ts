export type VectorHit = {
  chunkId: string;
  sourceId: string;
  sourceVersionId: string;
  chunkIndex: number;
  content: string;
  score: number;
};

/** Vector-search boundary. Every query is scoped by the authenticated user. */
export abstract class KnowledgeRetrievalPort {
  abstract search(
    userId: string,
    vector: number[],
    topK: number,
  ): Promise<VectorHit[]>;
}
