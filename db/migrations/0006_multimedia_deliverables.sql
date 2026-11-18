-- Multimedia deliverables (spec 017): generated files and their metadata.
-- Additive only. No data migration: older messages simply have media = null.
-- No down-migration is executed by the migration runner.

alter table public.messages
  add column if not exists media jsonb;

create table if not exists public.generated_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete cascade,
  message_id uuid references public.messages (id) on delete cascade,
  kind text not null,
  status text not null,
  mime_type text,
  file_name text not null,
  byte_size integer,
  content bytea,
  width integer,
  height integer,
  duration_seconds integer,
  model_id text not null,
  model_version text,
  provider_prompt text not null,
  parameters jsonb not null,
  citation jsonb,
  error_code text,
  error_message text,
  estimated_cost_usd numeric(12, 6),
  latency_ms integer,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint generated_media_kind_check check (kind in ('image', 'video')),
  constraint generated_media_status_check check (
    status in ('queued', 'generating', 'ready', 'failed', 'cancelled')
  ),
  constraint generated_media_byte_size_check check (
    byte_size is null or (byte_size > 0 and byte_size <= 20971520)
  ),
  constraint generated_media_duration_check check (
    duration_seconds is null or duration_seconds in (4, 6, 8)
  ),
  constraint generated_media_ready_check check (
    status <> 'ready' or (content is not null and byte_size is not null and mime_type is not null)
  ),
  constraint generated_media_attempts_check check (attempts between 0 and 3)
);

create index if not exists generated_media_user_created_idx
  on public.generated_media (user_id, created_at desc);

alter table public.generated_media enable row level security;

comment on table public.generated_media is
  'Generated image/video bytes and metadata owned by one authenticated user.';
comment on column public.messages.media is
  'Public media attachment contract for the message; null on older transcripts.';
comment on column public.generated_media.content is
  'Generated file bytes; null until the provider finishes, discarded on cancellation.';
comment on column public.generated_media.parameters is
  'Validated generation parameters only; never the full user briefing.';
comment on column public.generated_media.provider_prompt is
  'Prompt assembled from validated parameters and topic; used only for retries.';
comment on column public.generated_media.citation is
  'Optional connected-source citation attached when [n] was used.';

-- Rollback (manual, local only; not executed by the migration runner):
-- alter table public.messages drop column if exists media;
-- drop table if exists public.generated_media;
