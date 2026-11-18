"use client";

import { Button } from "@repo/ui/components/ui/button";
import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  EMPTY_PROMPT_MESSAGE,
  PROMPT_MAX_LENGTH,
  PROMPT_TOO_LONG_MESSAGE,
  type ChatMessage,
  type Citation,
  type Expert,
  type PromptSource,
} from "../../../lib/expert-chat/types";
import { FieldError, FormAlert } from "../../_components/form-parts";
import { labelClassName } from "../../_components/shared-styles";
import { loadConversationAction, sendPromptAction } from "../chat-actions";
import { CitedContent } from "./cited-content";
import { CitationPanel } from "./citation-panel";

type ExpertChatProps = {
  experts: Expert[];
  initialExpertId: string;
  initialMessages: ChatMessage[];
  initialError?: string | null;
};

/**
 * Chat shell. The catalog and the first transcript arrive from the server; all
 * later reads and writes go through Server Actions so the session token stays
 * on the server. Transcripts are cached per Expert so switching back does not
 * refetch, and a send always writes to the Expert captured at submit time.
 */
export function ExpertChat({
  experts,
  initialExpertId,
  initialMessages,
  initialError = null,
}: ExpertChatProps) {
  const [selectedExpertId, setSelectedExpertId] = useState(initialExpertId);
  const [transcripts, setTranscripts] = useState<Record<string, ChatMessage[]>>(
    initialExpertId === "" ? {} : { [initialExpertId]: initialMessages },
  );
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [promptByMessage, setPromptByMessage] = useState<
    Record<string, string>
  >({});
  const errorRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const selectedExpert = experts.find(
    (expert) => expert.id === selectedExpertId,
  );
  const messages = transcripts[selectedExpertId] ?? [];

  useEffect(() => {
    if (error !== null) {
      errorRef.current?.focus();
    }
  }, [error]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length, selectedExpertId]);

  async function handleExpertChange(nextExpertId: string) {
    setSelectedExpertId(nextExpertId);
    setError(null);
    setPromptError(null);
    setActiveCitation(null);

    if (
      nextExpertId === initialExpertId ||
      transcripts[nextExpertId] !== undefined
    ) {
      return;
    }

    setIsLoading(true);
    const result = await loadConversationAction(nextExpertId);
    setIsLoading(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setTranscripts((current) => ({
      ...current,
      [nextExpertId]: result.data.messages,
    }));
  }

  async function send(text: string, source: PromptSource) {
    const trimmed = text.trim();

    if (trimmed === "") {
      setPromptError(EMPTY_PROMPT_MESSAGE);
      return;
    }
    if (trimmed.length > PROMPT_MAX_LENGTH) {
      setPromptError(PROMPT_TOO_LONG_MESSAGE);
      return;
    }

    // Captured before awaiting: a later Expert change cannot reassign the reply.
    const expertId = selectedExpertId;

    setPrompt(trimmed);
    setError(null);
    setPromptError(null);
    setIsSending(true);

    const result = await sendPromptAction(expertId, trimmed, source);

    setIsSending(false);

    if (!result.ok) {
      setError(result.fieldErrors?.prompt ?? result.message);
      return;
    }

    setTranscripts((current) => ({
      ...current,
      [expertId]: [
        ...(current[expertId] ?? []),
        result.data.userMessage,
        result.data.expertMessage,
      ],
    }));
    setPromptByMessage((current) => ({
      ...current,
      [result.data.expertMessage.id]: trimmed,
    }));
    setPrompt("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(prompt, "typed");
  }

  if (selectedExpert === undefined) {
    return (
      <FormAlert ref={errorRef}>
        <p>{error ?? "No Experts are available right now. Try again later."}</p>
      </FormAlert>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Work with an Expert
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {selectedExpert.name} — {selectedExpert.scope}
          </p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground">
          {selectedExpert.role}
        </span>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground">
          Suggested questions
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedExpert.suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              disabled={isSending || isLoading}
              onClick={() => void send(suggestion, "suggestion")}
              className="inline-flex min-h-11 items-center rounded-lg border border-border bg-background px-4 py-2 text-left text-sm leading-snug text-foreground transition-colors duration-150 ease-out hover:border-primary hover:bg-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div
          role="log"
          aria-label={`Conversation with ${selectedExpert.name}`}
          aria-live="polite"
          aria-busy={isLoading || isSending}
          className="max-h-[55vh] min-h-[220px] space-y-4 overflow-y-auto p-5"
        >
          {messages.length === 0 ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              This is the first conversation with {selectedExpert.name}. Ask a
              question below or choose a suggested one.
            </p>
          ) : (
            messages.map((message) => (
              <article
                key={message.id}
                className="rounded-lg border border-border bg-surface p-4"
              >
                <p className="text-sm font-semibold text-foreground">
                  {message.role === "user" ? "You" : selectedExpert.name}
                </p>
                {message.role === "expert" ? (
                  <CitedContent
                    content={message.content}
                    citations={message.citations ?? []}
                    onOpen={setActiveCitation}
                  />
                ) : (
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                    {message.content}
                  </p>
                )}
                {message.role === "expert" &&
                message.answerStatus === "retrieval_unavailable" &&
                promptByMessage[message.id] !== undefined ? (
                  <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    <span>Knowledge search is unavailable right now.</span>
                    <button
                      type="button"
                      onClick={() =>
                        void send(promptByMessage[message.id] ?? "", "typed")
                      }
                      className="inline-flex min-h-9 items-center rounded-md border border-amber-500 px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Retry search
                    </button>
                  </div>
                ) : null}
              </article>
            ))
          )}
          <div ref={endRef} />
        </div>
      </div>

      <footer className="border-t border-border pt-6">
        <form
          onSubmit={handleSubmit}
          noValidate
          aria-busy={isSending || isLoading}
        >
          {error !== null ? (
            <FormAlert ref={errorRef}>
              <p>{error}</p>
            </FormAlert>
          ) : null}

          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end">
            <div className="min-w-0 md:w-64 md:shrink-0">
              <label htmlFor="expert-select" className={labelClassName}>
                Expert
              </label>
              <select
                id="expert-select"
                value={selectedExpertId}
                disabled={isSending || isLoading}
                onChange={(event) =>
                  void handleExpertChange(event.target.value)
                }
                className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground outline-none transition-colors duration-150 ease-out hover:bg-surface focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                {experts.map((expert) => (
                  <option key={expert.id} value={expert.id}>
                    {expert.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0 flex-1">
              <label htmlFor="expert-message" className={labelClassName}>
                Message
              </label>
              <textarea
                id="expert-message"
                value={prompt}
                rows={2}
                maxLength={PROMPT_MAX_LENGTH}
                placeholder="Ask a question..."
                disabled={isSending || isLoading}
                aria-invalid={promptError === null ? undefined : true}
                aria-describedby={
                  promptError === null ? undefined : "expert-message-error"
                }
                onChange={(event) => {
                  setPrompt(event.target.value);
                  if (promptError !== null) setPromptError(null);
                }}
                className="mt-2 min-h-[88px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-base text-foreground outline-none transition-colors duration-150 ease-out placeholder:text-muted-foreground hover:bg-surface focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              />
              {promptError !== null ? (
                <FieldError id="expert-message-error">{promptError}</FieldError>
              ) : null}
            </div>

            <Button
              type="submit"
              disabled={isSending || isLoading}
              className="md:shrink-0"
            >
              {isSending ? "Sending…" : "Send"}
            </Button>
          </div>
        </form>
      </footer>

      {activeCitation !== null ? (
        <CitationPanel
          citation={activeCitation}
          onClose={() => setActiveCitation(null)}
        />
      ) : null}
    </div>
  );
}
