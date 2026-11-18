import { describe, expect, it } from "vitest";

import {
  createGenerationSpanMetadata,
  createMediaSpanMetadata,
  createRetrievalSpanMetadata,
  createSourceSpanMetadata,
} from "./span-metadata";

describe("createRetrievalSpanMetadata", () => {
  it("inclui topK, threshold, scores, sourceIds e chunksConsidered", () => {
    expect(
      createRetrievalSpanMetadata({
        topK: 5,
        threshold: 0.35,
        scores: [0.9, 0.8],
        sourceIds: ["source-1", "source-2"],
        chunksConsidered: 12,
        queryEmbeddingModel: "text-embedding-3-small",
        vectorIndex: "knowledge_chunks",
      }),
    ).toEqual({
      topK: 5,
      threshold: 0.35,
      scores: [0.9, 0.8],
      sourceIds: ["source-1", "source-2"],
      chunksConsidered: 12,
      queryEmbeddingModel: "text-embedding-3-small",
      vectorIndex: "knowledge_chunks",
    });
  });
});

describe("createGenerationSpanMetadata", () => {
  it("registra versão do prompt, tokens, custo e finishReason", () => {
    expect(
      createGenerationSpanMetadata({
        promptVersion: "expert-chat-v1",
        tokensIn: 120,
        tokensOut: 340,
        estimatedCostUsd: 0.0003,
        finishReason: "stop",
      }),
    ).toEqual({
      promptVersion: "expert-chat-v1",
      tokensIn: 120,
      tokensOut: 340,
      estimatedCostUsd: 0.0003,
      finishReason: "stop",
    });
  });
});

describe("createMediaSpanMetadata", () => {
  it("define o contrato de mídia sem conteúdo, endereço ou hash", () => {
    const metadata = createMediaSpanMetadata({
      mediaKind: "image",
      modelId: "gpt-image-2",
      parameters: {
        size: "1024x1024",
        quality: "standard",
        content: "conteúdo sintético",
        url: "http://127.0.0.1/private",
      },
      sizeBytes: 2048,
      estimatedCostUsd: 0.04,
    });

    expect(metadata).toEqual({
      mediaKind: "image",
      modelId: "gpt-image-2",
      parameters: { size: "1024x1024", quality: "standard" },
      sizeBytes: 2048,
      estimatedCostUsd: 0.04,
    });
  });

  it("aceita metadados de vídeo com duração", () => {
    expect(
      createMediaSpanMetadata({
        mediaKind: "video",
        modelId: "gemini-stable-video",
        parameters: { durationSeconds: 8, aspectRatio: "16:9" },
        durationSeconds: 8,
      }),
    ).toMatchObject({
      mediaKind: "video",
      modelId: "gemini-stable-video",
      parameters: { durationSeconds: 8, aspectRatio: "16:9" },
      durationSeconds: 8,
    });
  });
});

describe("createSourceSpanMetadata", () => {
  it("expõe apenas identificadores e método de extração", () => {
    expect(
      createSourceSpanMetadata({
        sourceId: "source-1",
        sourceVersionId: "version-1",
        extractionMethod: "web-page",
      }),
    ).toEqual({
      sourceId: "source-1",
      sourceVersionId: "version-1",
      extractionMethod: "web-page",
    });
  });
});
