"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { FormAlert, StatusNotice } from "../../_components/form-parts";
import {
  ALREADY_CONNECTED_MESSAGE,
  ALL_SOURCE_FORMATS_MESSAGE,
  DOCUMENT_ACCEPT,
  MEDIA_ACCEPT,
  MEDIA_FORMATS_MESSAGE,
  formatSourceSize,
  isMediaType,
  MAX_FILES_PER_UPLOAD,
  MAX_MEDIA_DURATION_SECONDS,
  SOURCE_EMPTY_MESSAGE,
  SOURCE_FORMATS_MESSAGE,
  SOURCE_URL_REQUIRED_MESSAGE,
  type ConnectSourcesResponse,
  type MediaType,
  type ProcessingPhase,
  type SourceActionResult,
  type SourceStatus,
  type SourceSummary,
} from "../../../lib/knowledge/types";
import {
  connectSourceUrlAction,
  connectSourcesAction,
  deleteSourceAction,
  listSourcesAction,
  retrySourceVersionAction,
} from "../source-actions";

type KnowledgeSourcesProps = {
  initialSources: SourceSummary[];
  initialError?: string | null;
  mediaEnabled?: boolean;
};

type UploadKind = "documents" | MediaType;

const STATUS_LABELS: Record<SourceStatus, string> = {
  queued: "Queued",
  processing: "Processing",
  ready: "Ready",
  failed: "Failed",
};

const TYPE_LABELS: Record<SourceSummary["type"], string> = {
  pdf: "PDF",
  txt: "TXT",
  markdown: "MARKDOWN",
  image: "IMAGE",
  audio: "AUDIO",
  video: "VIDEO",
};

const PHASE_LABELS: Record<ProcessingPhase, string> = {
  extracting: "Extracting text",
  chunking: "Chunking text",
  embedding: "Creating embeddings",
};

function isPending(status: SourceStatus): boolean {
  return status === "queued" || status === "processing";
}

function statusClassName(status: SourceStatus): string {
  if (status === "ready") {
    return "bg-success-surface text-success";
  }
  if (status === "failed") {
    return "bg-destructive-surface text-destructive";
  }

  return "bg-secondary text-secondary-foreground";
}

function formatHint(kind: UploadKind): string {
  const formats =
    kind === "documents" ? SOURCE_FORMATS_MESSAGE : MEDIA_FORMATS_MESSAGE;

  return `${formats}. Up to ${MAX_FILES_PER_UPLOAD} files.`;
}

/**
 * Floating disclosure on the private home. Every read and write goes through
 * a Server Action, so the session token never reaches the browser.
 */
export function KnowledgeSources({
  initialSources,
  initialError = null,
  mediaEnabled = false,
}: KnowledgeSourcesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [sources, setSources] = useState(initialSources);
  const [kind, setKind] = useState<UploadKind>("documents");
  const [duration, setDuration] = useState("");
  const [fileCount, setFileCount] = useState(0);
  const [urlValue, setUrlValue] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isConnectingUrl, setIsConnectingUrl] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const durationRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async (reportErrors: boolean) => {
    const result = await listSourcesAction();

    if (!result.ok) {
      if (reportErrors) setError(result.message);
      return;
    }

    setSources(result.data.sources);
    if (reportErrors) setError(null);
  }, []);

  const hasPending = sources.some((source) => isPending(source.status));
  const acceptsMedia = mediaEnabled && kind !== "documents";
  const formats = mediaEnabled
    ? ALL_SOURCE_FORMATS_MESSAGE
    : SOURCE_FORMATS_MESSAGE;

  useEffect(() => {
    if (!isOpen || !hasPending) return;

    const timer = setInterval(() => {
      void refresh(false);
    }, 3_000);

    return () => clearInterval(timer);
  }, [hasPending, isOpen, refresh]);

  useEffect(() => {
    if (error !== null) errorRef.current?.focus();
  }, [error]);

  function handleKindChange(next: UploadKind) {
    setKind(next);
    setFileCount(0);
    if (inputRef.current !== null) inputRef.current.value = "";
    if (next !== "audio" && next !== "video") setDuration("");
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const files = Array.from(inputRef.current?.files ?? []);

    if (files.length === 0) {
      setNotice(null);
      setError(`Choose at least one ${formats} file.`);
      return;
    }

    const formData = new FormData();

    for (const file of files) formData.append("files", file);
    if (acceptsMedia && duration.trim() !== "") {
      formData.append("durationSeconds", duration.trim());
    }

    setIsUploading(true);
    setError(null);
    setNotice(null);

    const result: SourceActionResult<ConnectSourcesResponse> =
      await connectSourcesAction(formData);

    setIsUploading(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    const details = result.data.results.map((item) =>
      item.alreadyConnected
        ? `${item.name}: ${ALREADY_CONNECTED_MESSAGE}`
        : `${item.name}: ${STATUS_LABELS[item.status]}`,
    );

    setNotice(
      result.message === undefined ? details.join(" ") : result.message,
    );

    if (inputRef.current !== null) inputRef.current.value = "";
    setFileCount(0);
    await refresh(false);
  }

  async function handleConnectUrl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (urlValue.trim() === "") {
      setNotice(null);
      setError(SOURCE_URL_REQUIRED_MESSAGE);
      return;
    }

    setIsConnectingUrl(true);
    setError(null);
    setNotice(null);

    const result = await connectSourceUrlAction(urlValue);

    setIsConnectingUrl(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    const details = result.data.results.map((item) =>
      item.alreadyConnected
        ? `${item.name}: ${ALREADY_CONNECTED_MESSAGE}`
        : `${item.name}: ${STATUS_LABELS[item.status]}`,
    );

    setNotice(
      result.message === undefined ? details.join(" ") : result.message,
    );
    setUrlValue("");
    await refresh(false);
  }

  async function runRowAction(
    id: string,
    action: () => Promise<SourceActionResult<unknown>>,
    successMessage: string,
  ) {
    setBusyId(id);
    setError(null);
    setNotice(null);

    const result = await action();

    setBusyId(null);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setNotice(successMessage);
    await refresh(false);
  }

  return (
    <div className="fixed bottom-5 right-4 z-40 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      <section
        id="knowledge-sources-panel"
        hidden={!isOpen}
        aria-labelledby="knowledge-sources-title"
        className="w-[calc(100vw-2rem)] max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-xl sm:w-96"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <h2
              id="knowledge-sources-title"
              className="text-lg font-semibold text-foreground"
            >
              Knowledge sources
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect documents for your Experts.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close knowledge sources"
            onClick={() => setIsOpen(false)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xl text-foreground transition-colors hover:bg-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="max-h-[min(60vh,32rem)] overflow-y-auto p-4 sm:p-5">
          {error !== null ? (
            <FormAlert ref={errorRef}>
              <p>{error}</p>
            </FormAlert>
          ) : null}

          {notice !== null ? (
            <div className="mt-3">
              <StatusNotice title="Done">
                <p className="break-words">{notice}</p>
              </StatusNotice>
            </div>
          ) : null}

          <form onSubmit={(event) => void handleUpload(event)} noValidate>
            <label
              htmlFor="knowledge-source-files"
              className="block text-sm font-medium text-foreground"
            >
              Add files
            </label>
            <input
              ref={inputRef}
              id="knowledge-source-files"
              type="file"
              multiple
              accept={acceptsMedia ? MEDIA_ACCEPT : DOCUMENT_ACCEPT}
              aria-describedby="knowledge-source-files-hint"
              disabled={isUploading}
              onChange={(event) =>
                setFileCount(event.target.files?.length ?? 0)
              }
              className="mt-2 block w-full min-w-0 max-w-full rounded-md border border-input bg-background p-2 text-sm text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            />
            <p
              id="knowledge-source-files-hint"
              className="mt-1.5 text-sm leading-relaxed text-muted-foreground"
            >
              {formatHint(kind)}
              {fileCount > 0 ? ` ${fileCount} selected.` : ""}
            </p>

            {mediaEnabled ? (
              <div className="mt-3">
                <label
                  htmlFor="knowledge-source-kind"
                  className="block text-sm font-medium text-foreground"
                >
                  Source type
                </label>
                <select
                  id="knowledge-source-kind"
                  value={kind}
                  disabled={isUploading}
                  aria-describedby="knowledge-source-kind-hint"
                  onChange={(event) =>
                    handleKindChange(event.target.value as UploadKind)
                  }
                  className="mt-2 block min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                >
                  <option value="documents">Documents</option>
                  <option value="image">Image</option>
                  <option value="audio">Audio</option>
                  <option value="video">Video</option>
                </select>
                <p
                  id="knowledge-source-kind-hint"
                  className="mt-1.5 text-sm leading-relaxed text-muted-foreground"
                >
                  {kind === "documents"
                    ? "Documents are indexed directly."
                    : "Media is converted to text before indexing."}
                </p>
              </div>
            ) : null}

            {acceptsMedia && (kind === "audio" || kind === "video") ? (
              <div className="mt-3">
                <label
                  htmlFor="knowledge-source-duration"
                  className="block text-sm font-medium text-foreground"
                >
                  Duration (seconds)
                </label>
                <input
                  ref={durationRef}
                  id="knowledge-source-duration"
                  type="number"
                  min={1}
                  max={MAX_MEDIA_DURATION_SECONDS}
                  step={1}
                  inputMode="numeric"
                  value={duration}
                  disabled={isUploading}
                  aria-describedby="knowledge-source-duration-hint"
                  onChange={(event) => setDuration(event.target.value)}
                  className="mt-2 block min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                />
                <p
                  id="knowledge-source-duration-hint"
                  className="mt-1.5 text-sm leading-relaxed text-muted-foreground"
                >
                  Optional. Up to {MAX_MEDIA_DURATION_SECONDS / 60} minutes.
                </p>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isUploading}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUploading ? "Connecting..." : "Connect files"}
            </button>
          </form>

          <form
            onSubmit={(event) => void handleConnectUrl(event)}
            noValidate
            className="mt-6"
          >
            <label
              htmlFor="knowledge-source-url"
              className="block text-sm font-medium text-foreground"
            >
              Add a URL
            </label>
            <input
              id="knowledge-source-url"
              type="url"
              inputMode="url"
              autoComplete="url"
              placeholder="https://example.com/article"
              value={urlValue}
              aria-describedby="knowledge-source-url-hint"
              disabled={isConnectingUrl}
              onChange={(event) => setUrlValue(event.target.value)}
              className="mt-2 block w-full min-w-0 max-w-full rounded-md border border-input bg-background p-2 text-sm text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            />
            <p
              id="knowledge-source-url-hint"
              className="mt-1.5 text-sm leading-relaxed text-muted-foreground"
            >
              Public HTTP or HTTPS pages only. Tracking parameters are removed.
            </p>
            <button
              type="submit"
              disabled={isConnectingUrl}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isConnectingUrl ? "Connecting..." : "Connect URL"}
            </button>
          </form>

          <div className="mt-6 border-t border-border pt-5">
            <h3 className="text-sm font-semibold text-foreground">
              Connected sources
            </h3>

            {sources.length === 0 ? (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {SOURCE_EMPTY_MESSAGE}
              </p>
            ) : (
              <ul className="mt-3 space-y-3" aria-live="polite">
                {sources.map((source) => (
                  <li
                    key={source.id}
                    className="rounded-lg border border-border bg-surface p-3"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-medium text-foreground">
                          {source.name}
                        </p>
                        {source.url === undefined ? null : (
                          <p className="mt-1 break-all text-xs leading-relaxed text-muted-foreground">
                            {source.url}
                          </p>
                        )}
                        <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
                          {source.url === undefined
                            ? TYPE_LABELS[source.type]
                            : "URL"}{" "}
                          · {formatSourceSize(source.byteSize)} · v
                          {source.versionNumber} · {source.chunkCount} chunks
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${statusClassName(source.status)}`}
                      >
                        {STATUS_LABELS[source.status]}
                      </span>
                    </div>

                    {source.status === "processing" &&
                    source.processingPhase !== null &&
                    source.processingPhase !== undefined ? (
                      <p className="mt-2 text-xs font-medium text-muted-foreground">
                        {PHASE_LABELS[source.processingPhase]}
                      </p>
                    ) : null}

                    {source.status === "failed" && source.errorMessage ? (
                      <p className="mt-2 break-words text-xs font-medium text-destructive">
                        {source.errorMessage}
                      </p>
                    ) : null}

                    {source.isStale ? (
                      <p className="mt-2 text-xs font-medium text-muted-foreground">
                        Outdated version
                      </p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {source.status === "failed" ? (
                        <button
                          type="button"
                          disabled={busyId === source.id}
                          onClick={() =>
                            void runRowAction(
                              source.id,
                              () => retrySourceVersionAction(source.versionId),
                              "Retry started.",
                            )
                          }
                          className="inline-flex min-h-11 items-center rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isMediaType(source.type) ? "Try again" : "Retry"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={busyId === source.id}
                        onClick={() =>
                          void runRowAction(
                            source.id,
                            () => deleteSourceAction(source.id),
                            "Source removed.",
                          )
                        }
                        className="inline-flex min-h-11 items-center rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <button
        type="button"
        aria-label={
          isOpen ? "Close knowledge sources" : "Add knowledge sources"
        }
        aria-expanded={isOpen}
        aria-controls="knowledge-sources-panel"
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl font-semibold text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <span aria-hidden="true">{isOpen ? "×" : "+"}</span>
      </button>
    </div>
  );
}
