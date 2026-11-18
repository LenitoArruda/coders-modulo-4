-- Expert conversations: one conversation per (user, expert) and its messages.
-- Owned by the API; PostgreSQL is only the database. No direct browser access.

-- ---------------------------------------------------------------------------
-- conversations
-- ---------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  expert_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_expert_id_length check (
    char_length(expert_id) between 1 and 100
  ),
  constraint conversations_expert_id_check check (
    expert_id in (
      'cto', 'cmo', 'sales-director', 'customer-success-director',
      'customer-hero-director', 'ceo', 'cfo', 'coo', 'cpo'
    )
  ),
  constraint conversations_user_expert_unique unique (user_id, expert_id)
);

create trigger conversations_set_updated_at
before update on public.conversations
for each row
execute function public.set_updated_at();

comment on table public.conversations is
  'One chat transcript per authenticated user and Expert.';
comment on column public.conversations.expert_id is
  'Stable identifier from the Expert catalog; constrained to known experts.';
comment on constraint conversations_user_expert_unique on public.conversations is
  'A user has at most one conversation per Expert.';

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null,
  content text not null,
  -- clock_timestamp() is evaluated per row so a two-message insert keeps the
  -- user message before the Expert reply when ordered by created_at.
  created_at timestamptz not null default clock_timestamp(),
  constraint messages_role_check check (role in ('user', 'expert')),
  constraint messages_content_length check (
    char_length(btrim(content)) between 1 and 16000
  )
);

create index messages_conversation_order_idx
on public.messages (conversation_id, created_at, id);

comment on table public.messages is
  'Ordered user and Expert messages belonging to a conversation.';
comment on column public.messages.role is
  'Who authored the message: the authenticated user or the Expert.';

-- ---------------------------------------------------------------------------
-- Access control
-- ---------------------------------------------------------------------------
-- RLS stays enabled without policies as defense in depth: the API connects as
-- the schema owner, so no other role can read conversation data by mistake.
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- ---------------------------------------------------------------------------
-- Rollback (manual, local only; reverse dependency order)
-- ---------------------------------------------------------------------------
-- drop table if exists public.messages;
-- drop table if exists public.conversations;
