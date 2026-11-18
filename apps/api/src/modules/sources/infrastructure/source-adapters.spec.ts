import { describe, expect, it } from "vitest";

import {
  EmptySourceFileError,
  SourceEmbeddingError,
  SourceProcessingError,
} from "../domain/source.errors";

import { DocumentTextExtractorAdapter } from "./document-text-extractor.adapter";
import { OpenAIEmbeddingGeneratorAdapter } from "./openai-embedding-generator.adapter";

function file(buffer: Buffer, mimeType = "text/plain") {
  return {
    originalName: "notes.txt",
    mimeType,
    buffer,
  };
}

describe("source adapters", () => {
  it("extrai texto de TXT e Markdown sem registrar conteúdo", async () => {
    const adapter = new DocumentTextExtractorAdapter();

    await expect(
      adapter.extract(file(Buffer.from("  contexto  ")), "txt"),
    ).resolves.toBe("contexto");
    await expect(
      adapter.extract(
        file(Buffer.from("# title"), "text/markdown"),
        "markdown",
      ),
    ).resolves.toBe("# title");
  });

  it("rejeita bytes inválidos e PDF corrompido com erro público", async () => {
    const adapter = new DocumentTextExtractorAdapter();

    await expect(
      adapter.extract(file(Buffer.from([0xff, 0xfe, 0xfd])), "txt"),
    ).rejects.toBeInstanceOf(SourceProcessingError);
    await expect(
      adapter.extract(file(Buffer.from("not a pdf"), "application/pdf"), "pdf"),
    ).rejects.toBeInstanceOf(SourceProcessingError);
    await expect(
      adapter.extract(file(Buffer.from("   ")), "txt"),
    ).rejects.toBeInstanceOf(EmptySourceFileError);
  });

  it("falha antes de chamar a API quando a chave de embedding não está configurada", async () => {
    const adapter = new OpenAIEmbeddingGeneratorAdapter(1536, "  ");

    await expect(adapter.embed(["texto"])).rejects.toBeInstanceOf(
      SourceEmbeddingError,
    );
  });
});
