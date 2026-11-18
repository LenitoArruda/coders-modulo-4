import { EmbeddingGeneratorPort } from "../../modules/sources/application/ports/embedding-generator.port";
import { SourceEmbeddingError } from "../../modules/sources/domain/source.errors";

/** Deterministic, dimension-correct embeddings without an external model. */
export class FakeEmbeddingGenerator extends EmbeddingGeneratorPort {
  failure: Error | null = null;
  readonly calls: string[][] = [];

  async embed(texts: string[]): Promise<number[][]> {
    this.calls.push([...texts]);

    if (this.failure !== null) throw this.failure;

    return texts.map((text, index) => {
      const vector = new Array<number>(1536).fill(0);
      vector[index % 1536] = text.length / 1_000;
      vector[(index + 1) % 1536] = 0.5;

      return vector;
    });
  }
}

export function embeddingFailure(): Error {
  return new SourceEmbeddingError();
}
