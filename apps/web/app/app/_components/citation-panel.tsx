"use client";

import { useEffect, useRef } from "react";

import { citationLocation } from "../../../lib/expert-chat/citations";
import type { Citation } from "../../../lib/expert-chat/types";
import { Button } from "@repo/ui/components/ui/button";

type CitationPanelProps = {
  citation: Citation;
  onClose: () => void;
};

/** Side panel with the exact snippet injected into the model. */
export function CitationPanel({ citation, onClose }: CitationPanelProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-foreground/30">
      <div aria-hidden="true" className="h-full w-full" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="citation-panel-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col gap-4 overflow-y-auto border-l border-border bg-card p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Source {citation.citationNumber}
            </p>
            <h3
              id="citation-panel-title"
              className="mt-1 break-words text-xl font-semibold text-foreground"
            >
              {citation.sourceName}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {citation.sourceType} · {citationLocation(citation)}
            </p>
          </div>
          <Button
            ref={closeRef}
            type="button"
            variant="secondary"
            onClick={onClose}
            aria-label="Close source panel"
          >
            Close
          </Button>
        </div>

        {citation.isStale ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Outdated source: a newer version is available.
          </p>
        ) : null}
        {citation.sourceRemoved ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Source removed.
          </p>
        ) : null}

        <blockquote className="whitespace-pre-wrap break-words rounded-lg border border-border bg-surface p-4 text-sm leading-relaxed text-foreground">
          {citation.snippet}
        </blockquote>

        <p className="text-xs text-muted-foreground">Press Esc to close.</p>
      </aside>
    </div>
  );
}
