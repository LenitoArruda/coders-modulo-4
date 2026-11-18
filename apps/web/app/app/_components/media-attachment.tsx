"use client";

import { useEffect, useRef, useState } from "react";

import type { MediaAttachment } from "../../../lib/expert-chat/types";
import {
  cancelMediaAction,
  getMediaStatusAction,
  retryMediaAction,
} from "../media-actions";

const TERMINAL_STATUSES: MediaAttachment["status"][] = [
  "ready",
  "failed",
  "cancelled",
];
const POLL_INTERVAL_MS = 1_200;

function isTerminal(status: MediaAttachment["status"]): boolean {
  return TERMINAL_STATUSES.includes(status);
}

function describe(attachment: MediaAttachment): string {
  if (attachment.kind === "video") {
    return `${attachment.parameters.durationSeconds ?? 6}-second 720p video`;
  }

  return `${attachment.parameters.size ?? "1024x1024"} image`;
}

function readableBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

type MediaAttachmentViewProps = {
  initial: MediaAttachment;
  onUpdate: (attachment: MediaAttachment) => void;
};

/**
 * Inline preview with status polling, accessible controls and an authenticated
 * download. User-facing copy is en-US; provider errors are never rendered.
 */
export function MediaAttachmentView({
  initial,
  onUpdate,
}: MediaAttachmentViewProps) {
  const [attachment, setAttachment] = useState(initial);
  const [actionError, setActionError] = useState<string | null>(null);
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    setAttachment(initial);
  }, [initial]);

  useEffect(() => {
    if (isTerminal(attachment.status)) return;

    let active = true;
    const timer = setInterval(() => {
      void getMediaStatusAction(attachment.mediaId).then((result) => {
        if (!active || !result.ok) return;
        setAttachment(result.data);
        onUpdateRef.current(result.data);
      });
    }, POLL_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [attachment.mediaId, attachment.status]);

  async function run(
    action: (mediaId: string) => Promise<{
      ok: boolean;
      data?: MediaAttachment;
      message?: string;
    }>,
  ) {
    setActionError(null);
    const result = await action(attachment.mediaId);

    if (!result.ok || result.data === undefined) {
      setActionError(
        result.message ?? "We could not update this file. Try again.",
      );
      return;
    }

    setAttachment(result.data);
    onUpdate(result.data);
  }

  const previewUri = `/app/media/${encodeURIComponent(attachment.mediaId)}/content?inline=1`;
  const downloadUri = `/app/media/${encodeURIComponent(attachment.mediaId)}/content`;
  const statusLabel =
    attachment.status === "ready"
      ? "Ready"
      : attachment.status === "failed"
        ? "Failed"
        : attachment.status === "cancelled"
          ? "Cancelled"
          : attachment.status === "generating"
            ? "Generating…"
            : "Queued";

  return (
    <section
      aria-label={`Generated ${attachment.kind}`}
      className="mt-3 rounded-lg border border-border bg-background p-3"
      data-testid="media-attachment"
      data-media-id={attachment.mediaId}
      data-status={attachment.status}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">
          {describe(attachment)}
        </p>
        <p
          role="status"
          aria-live="polite"
          className="text-sm text-muted-foreground"
        >
          {statusLabel}
        </p>
      </div>

      {attachment.status === "ready" ? (
        <div className="mt-3">
          {attachment.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUri}
              alt={`Generated image preview, ${describe(attachment)}`}
              className="h-auto max-h-80 w-full rounded-md border border-border object-contain"
            />
          ) : (
            <video
              src={previewUri}
              controls
              preload="metadata"
              aria-label={`Generated video preview, ${describe(attachment)}`}
              className="max-h-80 w-full rounded-md border border-border"
            />
          )}
        </div>
      ) : null}

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <dt>Format</dt>
        <dd className="text-foreground">{attachment.mimeType ?? "Pending"}</dd>
        <dt>Size</dt>
        <dd className="text-foreground">
          {readableBytes(attachment.sizeBytes)}
        </dd>
        <dt>Model</dt>
        <dd className="text-foreground">{attachment.modelId}</dd>
        {attachment.citation === undefined ? null : (
          <>
            <dt>Source</dt>
            <dd className="text-foreground">
              [{attachment.citation.citationNumber}]{" "}
              {attachment.citation.sourceName} ·{" "}
              {attachment.citation.locationLabel}
            </dd>
          </>
        )}
      </dl>

      {attachment.errorMessage === undefined ? null : (
        <p className="mt-3 text-sm text-destructive">
          {attachment.errorMessage}
        </p>
      )}
      {actionError === null ? null : (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {actionError}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-3">
        {attachment.status === "ready" ? (
          <a
            href={downloadUri}
            download
            className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Download
          </a>
        ) : null}
        {isTerminal(attachment.status) ? (
          <button
            type="button"
            onClick={() => void run(retryMediaAction)}
            className="inline-flex min-h-11 items-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Try again
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void run(cancelMediaAction)}
            className="inline-flex min-h-11 items-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Cancel
          </button>
        )}
      </div>
    </section>
  );
}
