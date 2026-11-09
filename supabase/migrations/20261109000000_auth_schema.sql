-- Auth schema: users, opaque tokens and server-side sessions.
-- Custom auth owned by the API; Supabase/Postgres is only the database.

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
create table public.users (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null,
  password_hash text not null,
  email_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_first_name_length check (
    char_length(first_name) between 1 and 100
  ),
  constraint users_last_name_length check (
    char_length(last_name) between 1 and 100
  ),
  constraint users_email_length check (char_length(email) between 3 and 254),
  constraint users_email_normalized check (email = lower(btrim(email))),
  constraint users_email_format check (
    email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  constraint users_password_hash_length check (
    char_length(password_hash) between 20 and 255
  )
);

create unique index users_email_unique on public.users (lower(email));

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

create trigger users_set_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

comment on table public.users is
  'Application users authenticated by the API, not by Supabase Auth.';
comment on column public.users.email is
  'Normalized lowercase email; uniqueness is case-insensitive.';
comment on column public.users.password_hash is
  'Strong password hash; the plain password is never stored.';
comment on column public.users.email_confirmed_at is
  'UTC timestamp when the email was confirmed; null while unconfirmed.';

-- ---------------------------------------------------------------------------
-- auth_tokens
-- ---------------------------------------------------------------------------
create table public.auth_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  purpose text not null,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint auth_tokens_purpose_check check (
    purpose in ('email_confirmation', 'password_reset')
  ),
  constraint auth_tokens_token_hash_length check (
    char_length(token_hash) between 32 and 256
  ),
  constraint auth_tokens_expiry_after_creation check (expires_at > created_at),
  constraint auth_tokens_token_hash_unique unique (token_hash)
);

create index auth_tokens_user_id_idx on public.auth_tokens (user_id);

create index auth_tokens_user_purpose_active_idx
on public.auth_tokens (user_id, purpose)
where used_at is null;

comment on table public.auth_tokens is
  'Single-use opaque tokens for email confirmation and password reset.';
comment on column public.auth_tokens.token_hash is
  'Hash of the opaque token; the clear value is never stored.';
comment on column public.auth_tokens.used_at is
  'UTC timestamp when the token was consumed; null while unused.';

-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  origin text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  constraint sessions_origin_check check (
    origin in ('sign_up_confirmation', 'sign_in')
  ),
  constraint sessions_expiry_after_creation check (expires_at > created_at)
);

create index sessions_user_id_idx on public.sessions (user_id);

create index sessions_user_active_idx
on public.sessions (user_id)
where revoked_at is null;

comment on table public.sessions is
  'Server-side session registry used to validate and revoke JWTs.';
comment on column public.sessions.revoked_at is
  'UTC timestamp when the session was revoked; null while not revoked.';

-- ---------------------------------------------------------------------------
-- Access control
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.auth_tokens enable row level security;
alter table public.sessions enable row level security;

-- No policies for anon/authenticated: the browser cannot read or write auth data.
revoke all on table public.users from anon, authenticated;
revoke all on table public.auth_tokens from anon, authenticated;
revoke all on table public.sessions from anon, authenticated;

-- The API uses the server credential, which bypasses RLS.
grant select, insert, update, delete on table public.users to service_role;
grant select, insert, update, delete on table public.auth_tokens to service_role;
grant select, insert, update, delete on table public.sessions to service_role;

-- ---------------------------------------------------------------------------
-- Rollback (manual, local only; reverse dependency order)
-- ---------------------------------------------------------------------------
-- drop table if exists public.sessions;
-- drop table if exists public.auth_tokens;
-- drop table if exists public.users;
-- drop function if exists public.set_updated_at();
