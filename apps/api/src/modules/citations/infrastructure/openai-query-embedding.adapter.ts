import { OpenAIEmbeddings } from "@langchain/openai";
import { Inject, Injectable } from "@nestjs/common";

import { QueryEmbeddingPort } from "../application/ports/query-embedding.port";
import { QueryEmbeddingError } from "../domain/citation.errors";
import { QUERY_EMBEDDING_MODEL } from "../domain/citation";
import {
  CITATION_EMBEDDING_DIMENSIONS,
  CITATION_QUERY_EMBEDDING_API_KEY,
} from "../citations.tokens";

/** Server-only query embedding; the API key never leaves this adapter. */
@Injectable()
export class OpenAiQueryEmbeddingAdapter extends QueryEmbeddingPort {
  constructor(
    @Inject(CITATION_QUERY_EMBEDDING_API_KEY) private readonly apiKey: string,
    @Inject(CITATION_EMBEDDING_DIMENSIONS) private readonly dimensions: number,
  ) {
    super();
  }

  async embedQuery(text: string): Promise<number[]> {
    if (this.apiKey.trim() === "") throw new QueryEmbeddingError();

    try {
      const embeddings = new OpenAIEmbeddings({
        apiKey: this.apiKey,
        model: QUERY_EMBEDDING_MODEL,
        dimensions: this.dimensions,
      });
      const vector = await embeddings.embedQuery(text);

      if (vector.length !== this.dimensions) {
        throw new Error("unexpected query embedding size");
      }

      return vector;
    } catch {
      throw new QueryEmbeddingError();
    }
  }
}
