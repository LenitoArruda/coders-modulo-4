import type { Citation } from "./types";

const MARKER = /\[(\d+)\]/g;

export type ContentSegment =
  | { kind: "text"; text: string }
  | { kind: "citation"; marker: string; citation: Citation };

/**
 * Splits an answer into plain text and citation buttons. Unknown markers stay
 * as plain text because the API removes them before persistence.
 */
export function splitCitedContent(
  content: string,
  citations: Citation[],
): ContentSegment[] {
  const byNumber = new Map(
    citations.map((citation) => [citation.citationNumber, citation]),
  );
  const segments: ContentSegment[] = [];
  let cursor = 0;

  for (const match of content.matchAll(MARKER)) {
    const start = match.index ?? 0;
    const citation = byNumber.get(Number(match[1]));

    if (citation === undefined) continue;

    if (start > cursor) {
      segments.push({ kind: "text", text: content.slice(cursor, start) });
    }

    segments.push({ kind: "citation", marker: match[0], citation });
    cursor = start + match[0].length;
  }

  if (cursor < content.length) {
    segments.push({ kind: "text", text: content.slice(cursor) });
  }

  return segments;
}

/** Short, accessible description for each source button. */
export function citationLabel(citation: Citation): string {
  if (citation.sourceRemoved) {
    return `Source ${citation.citationNumber} removed: ${citation.sourceName}`;
  }

  return `Open source ${citation.citationNumber}: ${citation.sourceName}`;
}

/** Location text shown in the source panel, without server paths. */
export function citationLocation(citation: Citation): string {
  const parts: string[] = [];

  if (citation.location.page !== undefined) {
    parts.push(`Page ${citation.location.page}`);
  }
  if (citation.location.line !== undefined) {
    parts.push(`Line ${citation.location.line}`);
  }
  if (citation.location.timestampSeconds !== undefined) {
    const seconds = Math.floor(citation.location.timestampSeconds);
    parts.push(
      `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`,
    );
  }
  if (parts.length === 0) parts.push(citation.location.label);

  return parts.join(" · ");
}
