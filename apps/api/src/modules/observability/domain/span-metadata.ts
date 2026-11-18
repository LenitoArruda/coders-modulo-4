import { stripForbiddenMetadata } from "./metadata-policy";

export type RetrievalSpanMetadataInput = {
  topK: number;
  threshold: number;
  scores: number[];
  sourceIds: string[];
  chunksConsidered: number;
  queryEmbeddingModel?: string;
  vectorIndex?: string;
};

export type GenerationSpanMetadataInput = {
  promptVersion: string;
  tokensIn: number;
  tokensOut: number;
  estimatedCostUsd: number;
  finishReason: string;
};

export type MediaSpanMetadataInput = {
  mediaKind: "image" | "video";
  modelId: string;
  parameters: Record<string, unknown>;
  sizeBytes?: number;
  durationSeconds?: number;
  estimatedCostUsd?: number;
};

export type SourceSpanMetadataInput = {
  sourceId: string;
  sourceVersionId: string;
  extractionMethod: string;
};

export function createRetrievalSpanMetadata(
  input: RetrievalSpanMetadataInput,
): Record<string, unknown> {
  return stripForbiddenMetadata({
    topK: input.topK,
    threshold: input.threshold,
    scores: input.scores,
    sourceIds: input.sourceIds,
    chunksConsidered: input.chunksConsidered,
    ...(input.queryEmbeddingModel === undefined
      ? {}
      : { queryEmbeddingModel: input.queryEmbeddingModel }),
    ...(input.vectorIndex === undefined
      ? {}
      : { vectorIndex: input.vectorIndex }),
  });
}

export function createGenerationSpanMetadata(
  input: GenerationSpanMetadataInput,
): Record<string, unknown> {
  return stripForbiddenMetadata({
    promptVersion: input.promptVersion,
    tokensIn: input.tokensIn,
    tokensOut: input.tokensOut,
    estimatedCostUsd: input.estimatedCostUsd,
    finishReason: input.finishReason,
  });
}

/**
 * Media contract for the (not yet integrated) 017 slice. Only identifiers and
 * numeric parameters are emitted; file contents, paths and URLs are excluded.
 */
export function createMediaSpanMetadata(
  input: MediaSpanMetadataInput,
): Record<string, unknown> {
  return stripForbiddenMetadata({
    mediaKind: input.mediaKind,
    modelId: input.modelId,
    parameters: input.parameters,
    ...(input.sizeBytes === undefined ? {} : { sizeBytes: input.sizeBytes }),
    ...(input.durationSeconds === undefined
      ? {}
      : { durationSeconds: input.durationSeconds }),
    ...(input.estimatedCostUsd === undefined
      ? {}
      : { estimatedCostUsd: input.estimatedCostUsd }),
  });
}

export function createSourceSpanMetadata(
  input: SourceSpanMetadataInput,
): Record<string, unknown> {
  return stripForbiddenMetadata({
    sourceId: input.sourceId,
    sourceVersionId: input.sourceVersionId,
    extractionMethod: input.extractionMethod,
  });
}
