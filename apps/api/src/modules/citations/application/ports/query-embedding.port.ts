/** Embeds a single user query with the same model used during ingestion. */
export abstract class QueryEmbeddingPort {
  abstract embedQuery(text: string): Promise<number[]>;
}
