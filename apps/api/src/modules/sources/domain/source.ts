/** Shared knowledge-source contract, reused by the later platform slices. */
export type SourceType = "pdf" | "txt" | "markdown";

export type SourceStatus = "queued" | "processing" | "ready" | "failed";

export type Source = {
  id: string;
  userId: string;
  name: string;
  normalizedName: string;
  type: SourceType;
  currentVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SourceVersion = {
  id: string;
  sourceId: string;
  userId: string;
  contentHash: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
  type: SourceType;
  status: SourceStatus;
  chunkCount: number;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Chunk = {
  id: string;
  sourceId: string;
  sourceVersionId: string;
  userId: string;
  index: number;
  content: string;
};

export type Document = {
  sourceVersionId: string;
  text: string;
};

/** One row in the connected-sources panel: the source plus its current version. */
export type SourceSummary = {
  id: string;
  name: string;
  /** Present only for URL sources; `name` then holds the extracted page title. */
  url?: string;
  type: SourceType;
  byteSize: number;
  status: SourceStatus;
  versionId: string;
  versionNumber: number;
  chunkCount: number;
  isStale: boolean;
  createdAt: Date;
};

export type NewSourceVersion = {
  sourceId: string;
  contentHash: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
  type: SourceType;
  status: SourceStatus;
  errorMessage?: string | null;
};

export const ACCEPTED_SOURCE_FORMATS = "PDF, TXT or Markdown";
