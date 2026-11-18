import { describe, expect, it } from "vitest";

import {
  UnsupportedSourceFileError,
  SourceFileTooLargeError,
} from "./source.errors";
import {
  MAX_SOURCE_FILE_BYTES,
  chunkText,
  decodeUtf8,
  normalizeSourceName,
  sha256Hex,
  sourceTypeFor,
  validateSourceFiles,
} from "./source-file-policy";

describe("source file policy", () => {
  it("aceita PDF, TXT e Markdown com MIME compatível", () => {
    expect(sourceTypeFor("Plano.pdf", "application/pdf")).toBe("pdf");
    expect(sourceTypeFor("notas.txt", "text/plain")).toBe("txt");
    expect(sourceTypeFor("README.md", "text/markdown")).toBe("markdown");
    expect(sourceTypeFor("doc.markdown", "text/x-markdown")).toBe("markdown");
  });

  it("recusa tipo não suportado e MIME inconsistente", () => {
    expect(sourceTypeFor("virus.exe", "application/octet-stream")).toBeNull();
    expect(sourceTypeFor("foto.png", "image/png")).toBeNull();
    expect(sourceTypeFor("notas.txt", "application/pdf")).toBeNull();
    expect(() =>
      validateSourceFiles([
        {
          originalName: "virus.exe",
          mimeType: "application/octet-stream",
          buffer: Buffer.from("x"),
        },
      ]),
    ).toThrow(UnsupportedSourceFileError);
  });

  it("normaliza nome sem acentos e mantém a extensão", () => {
    expect(normalizeSourceName("C:\\docs\\Relatório Financeiro.TXT")).toBe(
      "relatorio financeiro.txt",
    );
  });

  it("calcula hash estável do conteúdo bruto", () => {
    expect(sha256Hex(Buffer.from("hello"))).toBe(
      sha256Hex(Buffer.from("hello")),
    );
    expect(sha256Hex(Buffer.from("hello"))).not.toBe(
      sha256Hex(Buffer.from("hello!")),
    );
  });

  it("valida o limite de tamanho na borda", () => {
    expect(() =>
      validateSourceFiles([
        {
          originalName: "grande.txt",
          mimeType: "text/plain",
          buffer: Buffer.alloc(MAX_SOURCE_FILE_BYTES + 1, 1),
        },
      ]),
    ).toThrow(SourceFileTooLargeError);
  });

  it("divide texto em chunks determinísticos e sobrepostos", () => {
    const text = Array.from(
      { length: 200 },
      (_, index) => `palavra${index}`,
    ).join(" ");
    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks).toEqual(chunkText(text));
    expect(chunks.every((chunk) => chunk.length <= 1_300)).toBe(true);
    expect(chunks.join(" ")).toContain("palavra199");
  });

  it("decodifica UTF-8 e recusa bytes inválidos", () => {
    expect(decodeUtf8(Buffer.from("relatório"))).toBe("relatório");
    expect(() => decodeUtf8(Buffer.from([0xff, 0xfe]))).toThrow();
  });
});
