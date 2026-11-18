"use client";

import {
  citationLabel,
  splitCitedContent,
} from "../../../lib/expert-chat/citations";
import type { Citation } from "../../../lib/expert-chat/types";

type CitedContentProps = {
  content: string;
  citations: Citation[];
  onOpen: (citation: Citation) => void;
};

/** Renders an answer with accessible inline citation buttons. */
export function CitedContent({
  content,
  citations,
  onOpen,
}: CitedContentProps) {
  const segments = splitCitedContent(content, citations);

  return (
    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
      {segments.map((segment, index) => {
        if (segment.kind === "text") {
          return <span key={`text-${index}`}>{segment.text}</span>;
        }

        const { citation } = segment;
        const label = citationLabel(citation);
        const accessibleName = citation.isStale
          ? `${label} (outdated source)`
          : label;

        return (
          <span
            key={`citation-${citation.citationNumber}`}
            className="inline-flex items-center gap-1"
          >
            <button
              type="button"
              disabled={citation.sourceRemoved}
              aria-label={accessibleName}
              title={citation.sourceRemoved ? "Source removed" : label}
              onClick={() => onOpen(citation)}
              className="inline-flex min-h-6 items-center rounded border border-border bg-surface-strong px-1.5 text-xs font-semibold text-foreground underline decoration-primary/60 underline-offset-2 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:no-underline"
            >
              {segment.marker}
            </button>
            {citation.isStale ? (
              <span className="text-xs text-muted-foreground">
                Outdated source
              </span>
            ) : null}
            {citation.sourceRemoved ? (
              <span className="text-xs text-muted-foreground">
                Source removed
              </span>
            ) : null}
          </span>
        );
      })}
    </p>
  );
}
