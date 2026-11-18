import { OpenAIEmbeddings } from "@langchain/openai";
import { Inject, Injectable } from "@nestjs/common";

import { EmbeddingGeneratorPort } from "../application/ports/embedding-generator.port";
import { SourceEmbeddingError } from "../domain/source.errors";
import {
  SOURCE_EMBEDDING_DIMENSIONS,
  SOURCE_OPENAI_API_KEY,
} from "../sources.tokens";

/**
 * OpenAI embeddings with the decision recorded in spec 013. The key is injected
 * from the server environment and is never included in an error or log.
 */
@Injectable()
export class OpenAIEmbeddingGeneratorAdapter extends EmbeddingGeneratorPort {
  constructor(
    @Inject(SOURCE_EMBEDDING_DIMENSIONS)
    private readonly dimensions: number,
    @Inject(SOURCE_OPENAI_API_KEY) private readonly apiKey: string,
  ) {
    super();
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (this.apiKey.trim() === "") throw new SourceEmbeddingError();

    try {
      const embeddings = new OpenAIEmbeddings({
        apiKey: this.apiKey,
        model: "text-embedding-3-small",
        dimensions: this.dimensions,
      });
      const vectors = await embeddings.embedDocuments(texts);

      if (
        vectors.length !== texts.length ||
        vectors.some((vector) => vector.length !== this.dimensions)
      ) {
        throw new Error("unexpected embedding response");
      }

      return vectors;
    } catch {
      throw new SourceEmbeddingError();
    }
  }
}
