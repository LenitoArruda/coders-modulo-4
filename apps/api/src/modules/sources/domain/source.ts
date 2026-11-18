/** Shared knowledge-source contract, reused by the later platform slices. */
export type DocumentSourceType = "pdf" | "txt" | "markdown";
export type MediaType = "image" | "audio" | "video";
export type SourceType = DocumentSourceType | MediaType;

export type SourceStatus = "queued" | "processing" | "ready" | "failed";

/** Detail of `processing`; the public status contract never changes. */
export type SourceProcessingPhase = "extracting" | "chunking" | "embedding";

/** How the text of a media source was obtained. */
export type MediaExtractionMethod = "ocr" | "transcription";

export const MEDIA_SOURCE_TYPES: readonly MediaType[] = [
  "image",
  "audio",
  "video",
];

export function isMediaSourceType(type: SourceType): type is MediaType {
  return (MEDIA_SOURCE_TYPES as readonly string[]).includes(type);
}

/**
 * Provenance and progress fields. Every field is optional so existing document
 * sources keep their original shape and public contract.
 */
export type MediaSourceMetadata = {
  processingPhase?: SourceProcessingPhase | null;
  mediaType?: MediaType | null;
  durationSeconds?: number | null;
  extractionMethod?: MediaExtractionMethod | null;
  extractionModelVersion?: string | null;
};

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

export type SourceVersion = MediaSourceMetadata & {
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
export type SourceSummary = MediaSourceMetadata & {
  id: string;
  name: string;
  /** Present only for URL sources; `name` then holds the extracted page title. */
  url?: string;
  type: SourceType;
  byteSize: number;
  status: SourceStatus;
  errorMessage: string | null;
  versionId: string;
  versionNumber: number;
  chunkCount: number;
  isStale: boolean;
  createdAt: Date;
};

export type NewSourceVersion = Partial<MediaSourceMetadata> & {
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
export const ACCEPTED_MEDIA_FORMATS = "JPEG, PNG, MP3 or MP4";
export const ACCEPTED_ALL_SOURCE_FORMATS =
  "PDF, TXT, Markdown, JPEG, PNG, MP3 or MP4";
