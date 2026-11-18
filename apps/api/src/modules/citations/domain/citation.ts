/** Contract shared by retrieval, persistence and the web chat. */
export type CitationSourceType = string;

export type CitationLocation = {
  /** 1-based page when the source provides one. */
  page?: number;
  /** 1-based line when the source provides one. */
  line?: number;
  /** Seconds from the start for time-based sources. */
  timestampSeconds?: number;
  /** Short, user-facing label such as "Chunk 3". Never a server path. */
  label: string;
};

export type Citation = {
  citationNumber: number;
  sourceId: string;
  sourceVersionId: string;
  chunkIndex: number;
  sourceName: string;
  sourceType: CitationSourceType;
  location: CitationLocation;
  /** Exact text injected into the prompt; never reformulated. */
  snippet: string;
  isStale: boolean;
  sourceRemoved: boolean;
};

export type RetrievalStatus = "matched" | "no_match" | "unavailable";

export type RetrievalMetadata = {
  queryEmbeddingModel: string;
  vectorIndex: string;
  topK: number;
  threshold: number;
  scores: number[];
  latencyMs: number;
  chunksConsidered: number;
  status: RetrievalStatus;
};

export type RetrievalResult = {
  status: RetrievalStatus;
  chunks: RetrievedChunk[];
  metadata: RetrievalMetadata;
};

export type RetrievedChunk = {
  chunkId: string;
  sourceId: string;
  sourceVersionId: string;
  chunkIndex: number;
  content: string;
  score: number;
  sourceName: string;
  sourceType: CitationSourceType;
  isStale: boolean;
  sourceRemoved: boolean;
};

export type GroundedSnippet = {
  citationNumber: number;
  content: string;
  citation: Citation;
};

export type GroundingContext = {
  status: RetrievalStatus;
  snippets: GroundedSnippet[];
  metadata: RetrievalMetadata;
  notice?: string;
};

export type AnswerStatus =
  "plain" | "with_source" | "no_match" | "retrieval_unavailable";

export type GroundedAnswer = {
  content: string;
  citations: Citation[];
  retrieval: RetrievalMetadata | null;
  answerStatus: AnswerStatus;
  invalidCitationNumbers: number[];
};

export const QUERY_EMBEDDING_MODEL = "text-embedding-3-small";
export const VECTOR_INDEX = "KnowledgeChunk";
export const NO_MATCH_ANSWER =
  "I couldn't find a basis in your connected knowledge for that question. Connect a source or try rephrasing it.";
export const RETRIEVAL_UNAVAILABLE_NOTICE =
  "Knowledge search is unavailable right now. Try again to include sources.";
