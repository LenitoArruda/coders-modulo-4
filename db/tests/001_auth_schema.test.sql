-- Schema tests for the native PostgreSQL auth database.
-- Run in a transaction and rolled back by scripts/db.mjs test.

create function pg_temp.assert_true(condition boolean, label text)
returns void
language plpgsql
as $$
begin
  if condition is not true then
    raise exception 'assertion failed: %', label;
  end if;
end;
$$;

create function pg_temp.expect_error(
  statement text,
  expected_state text,
  label text
)
returns void
language plpgsql
as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate <> expected_state then
      raise exception
        'assertion failed: % (expected SQLSTATE %, got %)',
        label, expected_state, sqlstate;
    end if;
    return;
  end;

  raise exception
    'assertion failed: % (expected SQLSTATE %, statement succeeded)',
    label, expected_state;
end;
$$;

-- Tables and columns ---------------------------------------------------------
select pg_temp.assert_true(
  to_regclass('public.users') is not null,
  'users table exists'
);
select pg_temp.assert_true(
  to_regclass('public.auth_tokens') is not null,
  'auth_tokens table exists'
);
select pg_temp.assert_true(
  to_regclass('public.sessions') is not null,
  'sessions table exists'
);

select pg_temp.assert_true(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'email'
  ),
  'users has email'
);
select pg_temp.assert_true(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'password_hash'
  ),
  'users has password hash'
);
select pg_temp.assert_true(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'email_confirmed_at'
  ),
  'users has email confirmation timestamp'
);
select pg_temp.assert_true(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'auth_tokens'
      and column_name = 'token_hash'
  ),
  'auth_tokens has token hash'
);
select pg_temp.assert_true(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'auth_tokens'
      and column_name = 'token'
  ),
  'auth_tokens has no plaintext token column'
);
select pg_temp.assert_true(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sessions'
      and column_name = 'origin'
  ),
  'sessions has origin'
);
select pg_temp.assert_true(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sessions'
      and column_name = 'revoked_at'
  ),
  'sessions has revocation timestamp'
);

select pg_temp.assert_true(
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
insert into public.users (first_name, last_name, email, password_hash)
values ('Ada', 'Lovelace', 'ada@example.com', repeat('a', 60));

select pg_temp.expect_error(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('Grace', 'Hopper', 'GRACE@EXAMPLE.COM', repeat('a', 60))
  $$,
  '23514',
  'an uppercase email is rejected'
);

select pg_temp.expect_error(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('Grace', 'Hopper', ' grace@example.com ', repeat('a', 60))
  $$,
  '23514',
  'an email with surrounding spaces is rejected'
);

select pg_temp.expect_error(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('Grace', 'Hopper', 'ada@example.com', repeat('a', 60))
  $$,
  '23505',
  'a duplicate normalized email violates users_email_unique'
);

select pg_temp.expect_error(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('Grace', 'Hopper', 'Ada@Example.com', repeat('a', 60))
  $$,
  '23514',
  'a duplicate email in another case is rejected by the normalization check'
);

select pg_temp.expect_error(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values (null, 'Hopper', 'grace@example.com', repeat('a', 60))
  $$,
  '23502',
  'first_name is required'
);

select pg_temp.expect_error(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('Grace', null, 'grace@example.com', repeat('a', 60))
  $$,
  '23502',
  'last_name is required'
);

select pg_temp.expect_error(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('Grace', 'Hopper', null, repeat('a', 60))
  $$,
  '23502',
  'email is required'
);

select pg_temp.expect_error(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('Grace', 'Hopper', 'grace@example.com', null)
  $$,
  '23502',
  'password_hash is required'
);

select pg_temp.expect_error(
  $$
    insert into public.auth_tokens (user_id, purpose, token_hash, expires_at)
    select null, 'email_confirmation', repeat('z', 64), now() + interval '1 hour'
    from public.users
    where email = 'ada@example.com'
  $$,
  '23502',
  'auth_tokens.user_id is required'
);

select pg_temp.expect_error(
  $$
    insert into public.auth_tokens (user_id, purpose, token_hash, expires_at)
    select id, null, repeat('z', 64), now() + interval '1 hour'
    from public.users
    where email = 'ada@example.com'
  $$,
  '23502',
  'auth_tokens.purpose is required'
);

select pg_temp.expect_error(
  $$
    insert into public.auth_tokens (user_id, purpose, token_hash, expires_at)
    select id, 'email_confirmation', null, now() + interval '1 hour'
    from public.users
    where email = 'ada@example.com'
  $$,
  '23502',
  'auth_tokens.token_hash is required'
);

select pg_temp.expect_error(
  $$
    insert into public.auth_tokens (user_id, purpose, token_hash, expires_at)
    select id, 'email_confirmation', repeat('z', 64), null
    from public.users
    where email = 'ada@example.com'
  $$,
  '23502',
  'auth_tokens.expires_at is required'
);

select pg_temp.expect_error(
  $$
    insert into public.sessions (user_id, origin, expires_at)
    select null, 'sign_in', now() + interval '7 days'
    from public.users
    where email = 'ada@example.com'
  $$,
  '23502',
  'sessions.user_id is required'
);

select pg_temp.expect_error(
  $$
    insert into public.sessions (user_id, origin, expires_at)
    select id, null, now() + interval '7 days'
    from public.users
    where email = 'ada@example.com'
  $$,
  '23502',
  'sessions.origin is required'
);

select pg_temp.expect_error(
  $$
    insert into public.sessions (user_id, origin, expires_at)
    select id, 'sign_in', null
    from public.users
    where email = 'ada@example.com'
  $$,
  '23502',
  'sessions.expires_at is required'
);

select pg_temp.expect_error(
  $$
    insert into public.auth_tokens (user_id, purpose, token_hash, expires_at)
    values (gen_random_uuid(), 'email_confirmation', repeat('z', 64), now() + interval '1 hour')
  $$,
  '23503',
  'a token for a missing user is rejected'
);

select pg_temp.expect_error(
  $$
    insert into public.sessions (user_id, origin, expires_at)
    values (gen_random_uuid(), 'sign_in', now() + interval '7 days')
  $$,
  '23503',
  'a session for a missing user is rejected'
);

-- Size and format limits -----------------------------------------------------
insert into public.users (first_name, last_name, email, password_hash)
values (repeat('f', 100), repeat('l', 100), 'max-names@example.com', repeat('a', 60));

select pg_temp.expect_error(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('', 'Hopper', 'grace@example.com', repeat('a', 60))
  $$,
  '23514',
  'an empty first_name is rejected'
);

select pg_temp.expect_error(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values (repeat('f', 101), 'Hopper', 'grace@example.com', repeat('a', 60))
  $$,
  '23514',
  'a first_name over 100 characters is rejected'
);

select pg_temp.expect_error(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('Grace', '', 'grace@example.com', repeat('a', 60))
  $$,
  '23514',
  'an empty last_name is rejected'
);

select pg_temp.expect_error(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('Grace', repeat('l', 101), 'grace@example.com', repeat('a', 60))
  $$,
  '23514',
  'a last_name over 100 characters is rejected'
);

insert into public.users (first_name, last_name, email, password_hash)
values ('Grace', 'Hopper', repeat('a', 242) || '@example.com', repeat('a', 60));

select pg_temp.expect_error(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('Grace', 'Hopper', repeat('b', 243) || '@example.com', repeat('a', 60))
  $$,
  '23514',
  'an email over 254 characters is rejected'
);

select pg_temp.expect_error(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('Grace', 'Hopper', 'ab', repeat('a', 60))
  $$,
  '23514',
  'an email under 3 characters is rejected'
);

select pg_temp.expect_error(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('Grace', 'Hopper', 'no-at-sign.example.com', repeat('a', 60))
  $$,
  '23514',
  'an email without @ is rejected'
);

select pg_temp.expect_error(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('Grace', 'Hopper', 'a@@example.com', repeat('a', 60))
  $$,
  '23514',
  'an email with two @ is rejected'
);

select pg_temp.expect_error(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('Grace', 'Hopper', 'a@example', repeat('a', 60))
  $$,
  '23514',
  'an email without a dotted domain is rejected'
);

select pg_temp.expect_error(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('Grace', 'Hopper', 'a b@example.com', repeat('a', 60))
  $$,
  '23514',
  'an email with inner spaces is rejected'
);

insert into public.users (first_name, last_name, email, password_hash)
values ('Grace', 'Hopper', 'hash20@example.com', repeat('h', 20));

select pg_temp.expect_error(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('Grace', 'Hopper', 'hash19@example.com', repeat('h', 19))
  $$,
  '23514',
  'a password_hash under 20 characters is rejected'
);

select pg_temp.expect_error(
  $$
    insert into public.users (first_name, last_name, email, password_hash)
    values ('Grace', 'Hopper', 'hash256@example.com', repeat('h', 256))
  $$,
  '23514',
  'a password_hash over 255 characters is rejected'
);

select pg_temp.expect_error(
  $$
    insert into public.auth_tokens (user_id, purpose, token_hash, expires_at)
    select id, 'email_confirmation', repeat('k', 31), now() + interval '1 hour'
    from public.users
    where email = 'ada@example.com'
  $$,
  '23514',
  'a token_hash under 32 characters is rejected'
);

select pg_temp.expect_error(
  $$
    insert into public.auth_tokens (user_id, purpose, token_hash, expires_at)
    select id, 'email_confirmation', repeat('k', 257), now() + interval '1 hour'
    from public.users
    where email = 'ada@example.com'
  $$,
  '23514',
  'a token_hash over 256 characters is rejected'
);

select pg_temp.expect_error(
  $$
    insert into public.auth_tokens (user_id, purpose, token_hash, expires_at)
    select id, 'email_confirmation', repeat('z', 64), now() - interval '1 hour'
    from public.users
    where email = 'ada@example.com'
  $$,
  '23514',
  'a token that expires before creation is rejected'
);

select pg_temp.expect_error(
  $$
    insert into public.sessions (user_id, origin, expires_at)
    select id, 'sign_in', now() - interval '1 hour'
    from public.users
    where email = 'ada@example.com'
  $$,
  '23514',
  'a session that expires before creation is rejected'
);

-- Token and session constraints ---------------------------------------------
insert into public.auth_tokens (user_id, purpose, token_hash, expires_at)
select id, 'email_confirmation', repeat('b', 64), now() + interval '24 hours'
from public.users
where email = 'ada@example.com';

select pg_temp.expect_error(
  $$
    insert into public.auth_tokens (user_id, purpose, token_hash, expires_at)
    select id, 'email_confirmation', repeat('b', 64), now() + interval '24 hours'
    from public.users
    where email = 'ada@example.com'
  $$,
  '23505',
  'a duplicate token hash is rejected'
);

select pg_temp.expect_error(
  $$
    insert into public.auth_tokens (user_id, purpose, token_hash, expires_at)
    select id, 'invalid_purpose', repeat('g', 64), now() + interval '1 hour'
    from public.users
    where email = 'ada@example.com'
  $$,
  '23514',
  'an invalid token purpose is rejected'
);

select pg_temp.expect_error(
  $$
    insert into public.sessions (user_id, origin, expires_at)
    select id, 'invalid_origin', now() + interval '7 days'
    from public.users
    where email = 'ada@example.com'
  $$,
  '23514',
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

create temporary table cascade_session_ids on commit drop as
select sessions.id
from public.sessions
join public.users on users.id = sessions.user_id
where users.email = 'cascade@example.com';

delete from public.users where email = 'cascade@example.com';

select pg_temp.assert_true(
  (
    select count(*) from public.auth_tokens
    where token_hash = repeat('c', 64)
  ) = 0,
  'tokens are removed when the user is deleted'
);

select pg_temp.assert_true(
  (
    select count(*) from public.sessions
    where id in (select id from cascade_session_ids)
  ) = 0,
  'sessions are removed when the user is deleted'
);

-- Active token and session queries -------------------------------------------
insert into public.users (first_name, last_name, email, password_hash)
values ('Token', 'Owner', 'tokens@example.com', repeat('t', 60));

insert into public.auth_tokens (user_id, purpose, token_hash, expires_at)
select id, 'email_confirmation', repeat('d', 64), now() + interval '1 hour'
from public.users
where email = 'tokens@example.com';

insert into public.auth_tokens (user_id, purpose, token_hash, expires_at, used_at)
select id, 'email_confirmation', repeat('e', 64), now() + interval '1 hour', now()
from public.users
where email = 'tokens@example.com';

insert into public.auth_tokens (user_id, purpose, token_hash, created_at, expires_at)
select id, 'email_confirmation', repeat('f', 64), now() - interval '2 hours', now() - interval '1 hour'
from public.users
where email = 'tokens@example.com';

select pg_temp.assert_true(
  (
    select count(*)
    from public.auth_tokens
    where user_id = (select id from public.users where email = 'tokens@example.com')
      and purpose = 'email_confirmation'
      and used_at is null
      and expires_at > now()
  ) = 1,
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
select id, 'sign_in', now() - interval '8 days', now() - interval '1 day'
from public.users
where email = 'sessions@example.com';

select pg_temp.assert_true(
  (
    select count(*)
    from public.sessions
    where user_id = (select id from public.users where email = 'sessions@example.com')
      and revoked_at is null
      and expires_at > now()
  ) = 1,
  'only unrevoked and unexpired sessions match the active session query'
);

-- updated_at -----------------------------------------------------------------
insert into public.users (first_name, last_name, email, password_hash)
values ('Touch', 'Me', 'touch@example.com', repeat('u', 60));

create temporary table touch_user on commit drop as
select id, updated_at
from public.users
where email = 'touch@example.com';

select pg_sleep(0.02);

update public.users
set first_name = 'Touched'
where email = 'touch@example.com';

select pg_temp.assert_true(
  (
    select users.updated_at > touch_user.updated_at
    from public.users
    join touch_user on touch_user.id = users.id
  ),
  'updated_at advances on update'
);

-- RLS, roles and privileges --------------------------------------------------
select pg_temp.assert_true(
  (select relrowsecurity from pg_class where oid = 'public.users'::regclass),
  'RLS is enabled on users'
);
select pg_temp.assert_true(
  (select relrowsecurity from pg_class where oid = 'public.auth_tokens'::regclass),
  'RLS is enabled on auth_tokens'
);
select pg_temp.assert_true(
  (select relrowsecurity from pg_class where oid = 'public.sessions'::regclass),
  'RLS is enabled on sessions'
);

select pg_temp.assert_true(
  (
    select count(*) from pg_policies
    where schemaname = 'public'
      and tablename in ('users', 'auth_tokens', 'sessions')
  ) = 0,
  'auth tables have no policies'
);

select pg_temp.assert_true(
  not exists (
    select 1 from pg_roles
    where rolname in ('anon', 'authenticated', 'service_role')
  ),
  'legacy provider roles do not exist in the native database'
);

create role auth_native_probe nologin;

select pg_temp.assert_true(
  not has_table_privilege('auth_native_probe', 'public.users', 'select'),
  'a role without grants cannot select users'
);
select pg_temp.assert_true(
  not has_table_privilege('auth_native_probe', 'public.auth_tokens', 'insert'),
  'a role without grants cannot insert tokens'
);
select pg_temp.assert_true(
  not has_table_privilege('auth_native_probe', 'public.sessions', 'update'),
  'a role without grants cannot update sessions'
);

set local role auth_native_probe;

do $$
begin
  begin
    perform count(*) from public.users;
    raise exception 'a role without grants could read users';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform count(*) from public.auth_tokens;
    raise exception 'a role without grants could read auth_tokens';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform count(*) from public.sessions;
    raise exception 'a role without grants could read sessions';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;

drop role auth_native_probe;
