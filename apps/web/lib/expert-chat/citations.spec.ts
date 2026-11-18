import { describe, expect, it } from "vitest";

import {
  citationLabel,
  citationLocation,
  splitCitedContent,
} from "./citations";
import type { Citation } from "./types";

const citation: Citation = {
  citationNumber: 1,
  sourceId: "source-1",
  sourceVersionId: "version-1",
  chunkIndex: 0,
  sourceName: "guide.txt",
  sourceType: "txt",
  location: { label: "Chunk 1", page: 3 },
  snippet: "Ship small batches.",
  isStale: true,
  sourceRemoved: false,
};

describe("splitCitedContent", () => {
  it("transforma marcadores válidos em segmentos de citação", () => {
    const segments = splitCitedContent("Intro [1] and [2] end.", [citation]);

    expect(segments).toEqual([
      { kind: "text", text: "Intro " },
      { kind: "citation", marker: "[1]", citation },
      { kind: "text", text: " and [2] end." },
    ]);
  });

  it("renderiza um texto quando não há citações", () => {
    expect(splitCitedContent("Plain answer.", [])).toEqual([
      { kind: "text", text: "Plain answer." },
    ]);
  });
});

describe("citation helpers", () => {
  it("descreve a fonte de forma acessível", () => {
    expect(citationLabel(citation)).toBe("Open source 1: guide.txt");
    expect(citationLabel({ ...citation, sourceRemoved: true })).toBe(
      "Source 1 removed: guide.txt",
    );
  });

  it("mostra localização sem caminhos internos", () => {
    expect(citationLocation(citation)).toBe("Page 3");
    expect(
      citationLocation({ ...citation, location: { label: "Chunk 1" } }),
    ).toBe("Chunk 1");
  });
});
