begin;

create extension if not exists pgtap with schema extensions;

set search_path = extensions, public, pg_catalog;

select plan(75);

-- Tables and columns ---------------------------------------------------------
select has_table('public', 'users', 'users table exists');
select has_table('public', 'auth_tokens', 'auth_tokens table exists');
select has_table('public', 'sessions', 'sessions table exists');

select has_column('public', 'users', 'email', 'users has email');
select has_column('public', 'users', 'password_hash', 'users has password hash');
select has_column(
  'public',
  'users',
  'email_confirmed_at',
  'users has email confirmation timestamp'
);
select has_column(
  'public',
  'auth_tokens',
  'token_hash',
  'auth_tokens has token hash'
);
select hasnt_column(
  'public',
  'auth_tokens',
  'token',
  'auth_tokens has no plaintext token column'
);
select has_column('public', 'sessions', 'origin', 'sessions has origin');
select has_column(
  'public',
  'sessions',
  'revoked_at',
  'sessions has revocation timestamp'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'users'
      and indexname = 'users_email_unique'
      and indexdef ~* 'lower\(email\)'
  ),
  'users.email has a case-insensitive unique index'
);

-- User constraints -----------------------------------------------------------
select lives_ok(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('Ada', 'Lovelace', 'ada@example.com', repeat('a', 60))
  $$,
  'a normalized user is persisted'
);

select throws_ok(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('Grace', 'Hopper', 'GRACE@EXAMPLE.COM', repeat('a', 60))
  $$,
  '23514',
  NULL,
  'an uppercase email is rejected'
);

select throws_ok(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('Grace', 'Hopper', ' grace@example.com ', repeat('a', 60))
  $$,
  '23514',
  NULL,
  'an email with surrounding spaces is rejected'
);

-- Unique email and NOT NULL ------------------------------------------------
select throws_ok(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('Grace', 'Hopper', 'ada@example.com', repeat('a', 60))
  $$,
  '23505',
  NULL,
  'a duplicate normalized email violates users_email_unique'
);

select throws_ok(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('Grace', 'Hopper', 'Ada@Example.com', repeat('a', 60))
  $$,
  '23514',
  NULL,
  'a duplicate email in another case is rejected by the normalization check'
);

select throws_ok(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values (null, 'Hopper', 'grace@example.com', repeat('a', 60))
  $$,
  '23502',
  NULL,
  'first_name is required'
);

select throws_ok(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('Grace', null, 'grace@example.com', repeat('a', 60))
  $$,
  '23502',
  NULL,
  'last_name is required'
);

select throws_ok(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('Grace', 'Hopper', null, repeat('a', 60))
  $$,
  '23502',
  NULL,
  'email is required'
);

select throws_ok(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('Grace', 'Hopper', 'grace@example.com', null)
  $$,
  '23502',
  NULL,
  'password_hash is required'
);

select throws_ok(
  $$
    insert into public.auth_tokens (user_id, purpose, token_hash, expires_at)
    select null, 'email_confirmation', repeat('z', 64), now() + interval '1 hour'
    from (select id from public.users where email = 'ada@example.com') as owner
  $$,
  '23502',
  NULL,
  'auth_tokens.user_id is required'
);

select throws_ok(
  $$
    insert into public.auth_tokens (user_id, purpose, token_hash, expires_at)
    select owner.id, null, repeat('z', 64), now() + interval '1 hour'
    from (select id from public.users where email = 'ada@example.com') as owner
  $$,
  '23502',
  NULL,
  'auth_tokens.purpose is required'
);

select throws_ok(
  $$
    insert into public.auth_tokens (user_id, purpose, token_hash, expires_at)
    select owner.id, 'email_confirmation', null, now() + interval '1 hour'
    from (select id from public.users where email = 'ada@example.com') as owner
  $$,
  '23502',
  NULL,
  'auth_tokens.token_hash is required'
);

select throws_ok(
  $$
    insert into public.auth_tokens (user_id, purpose, token_hash, expires_at)
    select owner.id, 'email_confirmation', repeat('z', 64), null
    from (select id from public.users where email = 'ada@example.com') as owner
  $$,
  '23502',
  NULL,
  'auth_tokens.expires_at is required'
);

select throws_ok(
  $$
    insert into public.sessions (user_id, origin, expires_at)
    select null, 'sign_in', now() + interval '7 days'
    from (select id from public.users where email = 'ada@example.com') as owner
  $$,
  '23502',
  NULL,
  'sessions.user_id is required'
);

select throws_ok(
  $$
    insert into public.sessions (user_id, origin, expires_at)
    select owner.id, null, now() + interval '7 days'
    from (select id from public.users where email = 'ada@example.com') as owner
  $$,
  '23502',
  NULL,
  'sessions.origin is required'
);

select throws_ok(
  $$
    insert into public.sessions (user_id, origin, expires_at)
    select owner.id, 'sign_in', null
    from (select id from public.users where email = 'ada@example.com') as owner
  $$,
  '23502',
  NULL,
  'sessions.expires_at is required'
);

select throws_ok(
  $$
    insert into public.auth_tokens (user_id, purpose, token_hash, expires_at)
    select gen_random_uuid(), 'email_confirmation', repeat('z', 64), now() + interval '1 hour'
    from (select id from public.users where email = 'ada@example.com') as owner
  $$,
  '23503',
  NULL,
  'a token for a missing user is rejected'
);

select throws_ok(
  $$
    insert into public.sessions (user_id, origin, expires_at)
    select gen_random_uuid(), 'sign_in', now() + interval '7 days'
    from (select id from public.users where email = 'ada@example.com') as owner
  $$,
  '23503',
  NULL,
  'a session for a missing user is rejected'
);

-- Size and format limits ------------------------------------------------------
select lives_ok(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values (repeat('f', 100), repeat('l', 100), 'max-names@example.com', repeat('a', 60))
  $$,
  'first_name and last_name accept 100 characters'
);

select throws_ok(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('', 'Hopper', 'grace@example.com', repeat('a', 60))
  $$,
  '23514',
  NULL,
  'an empty first_name is rejected'
);

select throws_ok(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values (repeat('f', 101), 'Hopper', 'grace@example.com', repeat('a', 60))
  $$,
  '23514',
  NULL,
  'a first_name over 100 characters is rejected'
);

select throws_ok(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('Grace', '', 'grace@example.com', repeat('a', 60))
  $$,
  '23514',
  NULL,
  'an empty last_name is rejected'
);

select throws_ok(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('Grace', repeat('l', 101), 'grace@example.com', repeat('a', 60))
  $$,
  '23514',
  NULL,
  'a last_name over 100 characters is rejected'
);

select lives_ok(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('Grace', 'Hopper', repeat('a', 242) || '@example.com', repeat('a', 60))
  $$,
  'an email with 254 characters is accepted'
);

select throws_ok(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('Grace', 'Hopper', repeat('b', 243) || '@example.com', repeat('a', 60))
  $$,
  '23514',
  NULL,
  'an email over 254 characters is rejected'
);

select throws_ok(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('Grace', 'Hopper', 'ab', repeat('a', 60))
  $$,
  '23514',
  NULL,
  'an email under 3 characters is rejected'
);

select throws_ok(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('Grace', 'Hopper', 'no-at-sign.example.com', repeat('a', 60))
  $$,
  '23514',
  NULL,
  'an email without @ is rejected'
);

select throws_ok(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('Grace', 'Hopper', 'a@@example.com', repeat('a', 60))
  $$,
  '23514',
  NULL,
  'an email with two @ is rejected'
);

select throws_ok(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('Grace', 'Hopper', 'a@example', repeat('a', 60))
  $$,
  '23514',
  NULL,
  'an email without a dotted domain is rejected'
);

select throws_ok(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('Grace', 'Hopper', 'a b@example.com', repeat('a', 60))
  $$,
  '23514',
  NULL,
  'an email with inner spaces is rejected'
);

select lives_ok(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('Grace', 'Hopper', 'hash20@example.com', repeat('h', 20))
  $$,
  'a 20 character password_hash is accepted'
);

select throws_ok(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('Grace', 'Hopper', 'hash19@example.com', repeat('h', 19))
  $$,
  '23514',
  NULL,
  'a password_hash under 20 characters is rejected'
);

select throws_ok(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('Grace', 'Hopper', 'hash256@example.com', repeat('h', 256))
  $$,
  '23514',
  NULL,
  'a password_hash over 255 characters is rejected'
);

select throws_ok(
  $$
    insert into public.auth_tokens (user_id, purpose, token_hash, expires_at)
    select owner.id, 'email_confirmation', repeat('k', 31), now() + interval '1 hour'
    from (select id from public.users where email = 'ada@example.com') as owner
  $$,
  '23514',
  NULL,
  'a token_hash under 32 characters is rejected'
);

select throws_ok(
  $$
    insert into public.auth_tokens (user_id, purpose, token_hash, expires_at)
    select owner.id, 'email_confirmation', repeat('k', 257), now() + interval '1 hour'
    from (select id from public.users where email = 'ada@example.com') as owner
  $$,
  '23514',
  NULL,
  'a token_hash over 256 characters is rejected'
);

select throws_ok(
  $$
    insert into public.auth_tokens (user_id, purpose, token_hash, expires_at)
    select owner.id, 'email_confirmation', repeat('z', 64), now() - interval '1 hour'
    from (select id from public.users where email = 'ada@example.com') as owner
  $$,
  '23514',
  NULL,
  'a token that expires before creation is rejected'
);

select throws_ok(
  $$
    insert into public.sessions (user_id, origin, expires_at)
    select owner.id, 'sign_in', now() - interval '1 hour'
    from (select id from public.users where email = 'ada@example.com') as owner
  $$,
  '23514',
  NULL,
  'a session that expires before creation is rejected'
);

-- Token and session constraints ---------------------------------------------
select lives_ok(
  $$
    insert into public.auth_tokens (user_id, purpose, token_hash, expires_at)
    select id, 'email_confirmation', repeat('b', 64), now() + interval '24 hours'
    from public.users
    where email = 'ada@example.com'
  $$,
  'a confirmation token hash is persisted'
);

select throws_ok(
  $$
    insert into public.auth_tokens (user_id, purpose, token_hash, expires_at)
    select id, 'email_confirmation', repeat('b', 64), now() + interval '24 hours'
    from public.users
    where email = 'ada@example.com'
  $$,
  '23505',
  NULL,
  'a duplicate token hash is rejected'
);

select throws_ok(
  $$
    insert into public.auth_tokens (user_id, purpose, token_hash, expires_at)
    select id, 'invalid_purpose', repeat('g', 64), now() + interval '1 hour'
    from public.users
    where email = 'ada@example.com'
  $$,
  '23514',
  NULL,
  'an invalid token purpose is rejected'
);

select throws_ok(
  $$
    insert into public.sessions (user_id, origin, expires_at)
    select id, 'invalid_origin', now() + interval '7 days'
    from public.users
    where email = 'ada@example.com'
  $$,
  '23514',
  NULL,
  'an invalid session origin is rejected'
);

-- Cascade --------------------------------------------------------------------
insert into public.users (first_name, last_name, email, password_hash)
values ('Cascade', 'User', 'cascade@example.com', repeat('c', 60));

insert into public.auth_tokens (user_id, purpose, token_hash, expires_at)
select id, 'password_reset', repeat('c', 64), now() + interval '1 hour'
from public.users
where email = 'cascade@example.com';

insert into public.sessions (user_id, origin, expires_at)
select id, 'sign_in', now() + interval '7 days'
from public.users
where email = 'cascade@example.com';

create temporary table pg_temp.cascade_session_ids on commit drop as
select sessions.id
from public.sessions
join public.users on users.id = sessions.user_id
where users.email = 'cascade@example.com';

delete from public.users where email = 'cascade@example.com';

select is(
  (
    select count(*)
    from public.auth_tokens
    where token_hash = repeat('c', 64)
  ),
  0::bigint,
  'tokens are removed when the user is deleted'
);

select is(
  (
    select count(*)
    from public.sessions
    where id in (select id from pg_temp.cascade_session_ids)
  ),
  0::bigint,
  'sessions are removed when the user is deleted'
);

-- Active token and session queries -------------------------------------------
insert into public.users (first_name, last_name, email, password_hash)
values ('Token', 'Owner', 'tokens@example.com', repeat('t', 60));

insert into public.auth_tokens
  (user_id, purpose, token_hash, expires_at)
select id, 'email_confirmation', repeat('d', 64), now() + interval '1 hour'
from public.users
where email = 'tokens@example.com';

insert into public.auth_tokens
  (user_id, purpose, token_hash, expires_at, used_at)
select id, 'email_confirmation', repeat('e', 64), now() + interval '1 hour', now()
from public.users
where email = 'tokens@example.com';

insert into public.auth_tokens
  (user_id, purpose, token_hash, created_at, expires_at)
select
  id,
  'email_confirmation',
  repeat('f', 64),
  now() - interval '2 hours',
  now() - interval '1 hour'
from public.users
where email = 'tokens@example.com';

select is(
  (
    select count(*)
    from public.auth_tokens
    where user_id = (select id from public.users where email = 'tokens@example.com')
      and purpose = 'email_confirmation'
      and used_at is null
      and expires_at > now()
  ),
  1::bigint,
  'only unused and unexpired tokens match the active token query'
);

insert into public.users (first_name, last_name, email, password_hash)
values ('Session', 'Owner', 'sessions@example.com', repeat('s', 60));

insert into public.sessions (user_id, origin, expires_at)
select id, 'sign_in', now() + interval '7 days'
from public.users
where email = 'sessions@example.com';

insert into public.sessions (user_id, origin, expires_at, revoked_at)
select id, 'sign_in', now() + interval '7 days', now()
from public.users
where email = 'sessions@example.com';

insert into public.sessions (user_id, origin, created_at, expires_at)
select
  id,
  'sign_in',
  now() - interval '8 days',
  now() - interval '1 day'
from public.users
where email = 'sessions@example.com';

select is(
  (
    select count(*)
    from public.sessions
    where user_id = (select id from public.users where email = 'sessions@example.com')
      and revoked_at is null
      and expires_at > now()
  ),
  1::bigint,
  'only unrevoked and unexpired sessions match the active session query'
);

-- updated_at -----------------------------------------------------------------
insert into public.users (first_name, last_name, email, password_hash)
values ('Touch', 'Me', 'touch@example.com', repeat('u', 60));

create temporary table pg_temp.touch_user on commit drop as
select id, updated_at
from public.users
where email = 'touch@example.com';

select pg_sleep(0.02);

update public.users
set first_name = 'Touched'
where email = 'touch@example.com';

select ok(
  (
    select users.updated_at > pg_temp.touch_user.updated_at
    from public.users
    join pg_temp.touch_user on pg_temp.touch_user.id = users.id
  ),
  'updated_at advances on update'
);

-- RLS and privileges ---------------------------------------------------------
select ok(
  (select relrowsecurity from pg_class where oid = 'public.users'::regclass),
  'RLS is enabled on users'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.auth_tokens'::regclass),
  'RLS is enabled on auth_tokens'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.sessions'::regclass),
  'RLS is enabled on sessions'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename in ('users', 'auth_tokens', 'sessions')
  ),
  0::bigint,
  'auth tables have no policies for public roles'
);

select ok(
  not has_table_privilege('anon', 'public.users', 'select'),
  'anon cannot select users'
);
select ok(
  not has_table_privilege('authenticated', 'public.users', 'select'),
  'authenticated cannot select users'
);
select ok(
  not has_table_privilege('anon', 'public.auth_tokens', 'insert'),
  'anon cannot insert tokens'
);
select ok(
  not has_table_privilege('authenticated', 'public.sessions', 'update'),
  'authenticated cannot update sessions'
);
select ok(
  has_table_privilege('service_role', 'public.sessions', 'select')
    and has_table_privilege('service_role', 'public.sessions', 'insert')
    and has_table_privilege('service_role', 'public.sessions', 'update')
    and has_table_privilege('service_role', 'public.sessions', 'delete'),
  'service_role can read and write sessions'
);

-- Real access attempts as anon and authenticated -----------------------------
set local role anon;

select throws_ok(
  $$ select count(*) from public.users $$,
  '42501',
  NULL,
  'anon cannot read users'
);

select throws_ok(
  $$ select count(*) from public.auth_tokens $$,
  '42501',
  NULL,
  'anon cannot read auth_tokens'
);

select throws_ok(
  $$ select count(*) from public.sessions $$,
  '42501',
  NULL,
  'anon cannot read sessions'
);

select throws_ok(
  $$ insert into public.users (first_name, last_name, email, password_hash) values ('Anon', 'User', 'anon@example.com', repeat('a', 60)) $$,
  '42501',
  NULL,
  'anon cannot insert users'
);

select throws_ok(
  $$ insert into public.auth_tokens (user_id, purpose, token_hash, expires_at) values (gen_random_uuid(), 'password_reset', repeat('q', 64), now() + interval '1 hour') $$,
  '42501',
  NULL,
  'anon cannot insert tokens'
);

select throws_ok(
  $$ update public.sessions set revoked_at = now() $$,
  '42501',
  NULL,
  'anon cannot update sessions'
);

select throws_ok(
  $$ delete from public.users $$,
  '42501',
  NULL,
  'anon cannot delete users'
);

reset role;
set local role authenticated;

select throws_ok(
  $$ select count(*) from public.users $$,
  '42501',
  NULL,
  'authenticated cannot read users'
);

select throws_ok(
  $$ update public.sessions set revoked_at = now() $$,
  '42501',
  NULL,
  'authenticated cannot update sessions'
);

reset role;

select * from finish();

rollback;
