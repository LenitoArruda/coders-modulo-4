/** Generates one embedding per chunk, in the same order as the input. */
export abstract class EmbeddingGeneratorPort {
  abstract embed(texts: string[]): Promise<number[][]>;
}
