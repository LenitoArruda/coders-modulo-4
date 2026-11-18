-- RAG citations (spec 016): optional metadata on Expert messages.
-- Additive only: transcripts written before this migration stay unchanged.

alter table public.messages
  add column if not exists citations jsonb,
  add column if not exists retrieval jsonb,
  add column if not exists answer_status text;

do $$
begin
  alter table public.messages
    add constraint messages_answer_status_check
    check (
      answer_status is null
      or answer_status in (
        'plain', 'with_source', 'no_match', 'retrieval_unavailable'
      )
    );
exception
  when duplicate_object then null;
end $$;

comment on column public.messages.citations is
  'Validated [n] citations with source/chunk metadata; no server paths or secrets.';
comment on column public.messages.retrieval is
  'Retrieval metadata (model, index, topK, threshold, scores, latency) without content hashes.';
comment on column public.messages.answer_status is
  'How the Expert answer was grounded: plain, with_source, no_match or retrieval_unavailable.';

-- Rollback (manual, local only):
-- alter table public.messages drop column if exists answer_status;
-- alter table public.messages drop column if exists retrieval;
-- alter table public.messages drop column if exists citations;
