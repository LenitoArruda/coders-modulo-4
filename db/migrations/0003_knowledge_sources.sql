-- Knowledge sources: connections, versions, original bytes and extracted chunks.
-- The API owns every query; PostgreSQL is only the local database.

-- ---------------------------------------------------------------------------
-- sources
-- ---------------------------------------------------------------------------
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  normalized_name text not null,
  type text not null,
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sources_name_length check (char_length(name) between 1 and 255),
  constraint sources_normalized_name_length check (
    char_length(normalized_name) between 1 and 255
  ),
  constraint sources_type_check check (type in ('pdf', 'txt', 'markdown')),
  constraint sources_user_name_unique unique (user_id, normalized_name),
  -- The composite unique key is referenced by child tables so ownership is
  -- enforced by the schema, not only by application queries.
  constraint sources_owner_key unique (id, user_id)
);

create trigger sources_set_updated_at
before update on public.sources
for each row
execute function public.set_updated_at();

comment on table public.sources is
  'A user connection grouping every version of the same normalized file name.';
comment on column public.sources.current_version_id is
  'Current SourceVersion; older versions are stale for future citations.';

-- ---------------------------------------------------------------------------
-- source_versions
-- ---------------------------------------------------------------------------
create table public.source_versions (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null,
  user_id uuid not null,
  content_hash char(64) not null,
  original_name text not null,
  mime_type text not null,
  byte_size bigint not null,
  type text not null,
  status text not null default 'queued',
  chunk_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint source_versions_owner_fk foreign key (source_id, user_id)
    references public.sources (id, user_id) on delete cascade,
  constraint source_versions_original_name_length check (
    char_length(original_name) between 1 and 255
  ),
  constraint source_versions_byte_size_check check (byte_size > 0),
  constraint source_versions_type_check check (type in ('pdf', 'txt', 'markdown')),
  constraint source_versions_status_check check (
    status in ('queued', 'processing', 'ready', 'failed')
  ),
  constraint source_versions_chunk_count_check check (chunk_count >= 0),
  constraint source_versions_owner_key unique (id, user_id)
);

create index source_versions_source_idx
on public.source_versions (user_id, source_id, created_at desc);

-- A failed version is retried in place; every other state is unique per hash.
create unique index source_versions_active_hash_unique
on public.source_versions (user_id, content_hash)
where status <> 'failed';

create trigger source_versions_set_updated_at
before update on public.source_versions
for each row
execute function public.set_updated_at();

alter table public.sources
add constraint sources_current_version_fk
foreign key (current_version_id, user_id)
references public.source_versions (id, user_id) on delete set null;

comment on table public.source_versions is
  'Immutable content version identified by SHA-256 within one user account.';
comment on column public.source_versions.content_hash is
  'SHA-256 of the original bytes; never written to logs or telemetry.';
comment on index public.source_versions_active_hash_unique is
  'Prevents two simultaneously valid versions for the same user and content.';

-- ---------------------------------------------------------------------------
-- source_files
-- ---------------------------------------------------------------------------
create table public.source_files (
  id uuid primary key default gen_random_uuid(),
  source_version_id uuid not null,
  user_id uuid not null,
  content bytea not null,
  byte_size bigint not null,
  created_at timestamptz not null default now(),
  constraint source_files_version_unique unique (source_version_id),
  constraint source_files_owner_fk foreign key (source_version_id, user_id)
    references public.source_versions (id, user_id) on delete cascade,
  constraint source_files_byte_size_check check (byte_size > 0)
);

comment on table public.source_files is
  'Original file bytes stored in the database, deleted with their version.';

-- ---------------------------------------------------------------------------
-- source_chunks
-- ---------------------------------------------------------------------------
create table public.source_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null,
  source_version_id uuid not null,
  user_id uuid not null,
  chunk_index integer not null,
  content text not null,
  created_at timestamptz not null default now(),
  constraint source_chunks_owner_fk foreign key (source_version_id, user_id)
    references public.source_versions (id, user_id) on delete cascade,
  constraint source_chunks_content_check check (char_length(content) > 0),
  constraint source_chunks_index_check check (chunk_index >= 0),
  constraint source_chunks_version_index_unique unique (source_version_id, chunk_index)
);

create index source_chunks_source_idx
on public.source_chunks (user_id, source_id);

comment on table public.source_chunks is
  'Extracted text chunks mirrored as vectors in the local Weaviate collection.';

-- ---------------------------------------------------------------------------
-- Access control
-- ---------------------------------------------------------------------------
-- RLS stays enabled without policies as defense in depth: the API connects as
-- the schema owner and scopes every query by the authenticated user id.
alter table public.sources enable row level security;
alter table public.source_versions enable row level security;
alter table public.source_files enable row level security;
alter table public.source_chunks enable row level security;

-- ---------------------------------------------------------------------------
-- Rollback (manual, local only; reverse dependency order)
-- ---------------------------------------------------------------------------
-- alter table public.sources drop constraint if exists sources_current_version_fk;
-- drop table if exists public.source_chunks;
-- drop table if exists public.source_files;
-- drop table if exists public.source_versions;
-- drop table if exists public.sources;
