/** Raised when the vector index cannot be queried. Never leaks transport details. */
export class KnowledgeRetrievalError extends Error {
  constructor(cause?: unknown) {
    super("Knowledge retrieval failed");
    this.name = "KnowledgeRetrievalError";
    this.cause = cause;
  }
}

/** Raised when the query embedding cannot be generated. */
export class QueryEmbeddingError extends Error {
  constructor(cause?: unknown) {
    super("Query embedding failed");
    this.name = "QueryEmbeddingError";
    this.cause = cause;
  }
}
