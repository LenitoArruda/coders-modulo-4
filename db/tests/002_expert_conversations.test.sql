-- Schema tests for expert conversations and messages.
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
  to_regclass('public.conversations') is not null,
  'conversations table exists'
);
select pg_temp.assert_true(
  to_regclass('public.messages') is not null,
  'messages table exists'
);

-- RLS enabled without policies ----------------------------------------------
select pg_temp.assert_true(
  (select relrowsecurity from pg_class where oid = 'public.conversations'::regclass),
  'conversations has RLS enabled'
);
select pg_temp.assert_true(
  (select relrowsecurity from pg_class where oid = 'public.messages'::regclass),
  'messages has RLS enabled'
);
select pg_temp.assert_true(
  (select count(*) from pg_policies where tablename = 'conversations') = 0,
  'conversations has no policies'
);
select pg_temp.assert_true(
  (select count(*) from pg_policies where tablename = 'messages') = 0,
  'messages has no policies'
);

-- Constraints ---------------------------------------------------------------
-- These statements reference a seeded user created via a plpgsql block.
do $$
declare
  v_user_id uuid;
  v_conversation_id uuid;
begin
  insert into public.users (first_name, last_name, email, password_hash)
  values ('Grace', 'Hopper', 'grace.expert@example.com', 'seed-password-hash-with-32-chars')
  returning id into v_user_id;

  insert into public.conversations (user_id, expert_id)
  values (v_user_id, 'cto')
  returning id into v_conversation_id;

  if v_conversation_id is null then
    raise exception 'assertion failed: conversation insert returned no id';
  end if;

  -- One conversation per (user, expert).
  begin
    insert into public.conversations (user_id, expert_id)
    values (v_user_id, 'cto');
    raise exception 'assertion failed: duplicate (user, expert) was allowed';
  exception when unique_violation then
    null;
  end;

  -- Unknown expert id is rejected.
  begin
    insert into public.conversations (user_id, expert_id)
    values (v_user_id, 'not-an-expert');
    raise exception 'assertion failed: unknown expert was allowed';
  exception when check_violation then
    null;
  end;

  -- Invalid message role is rejected.
  begin
    insert into public.messages (conversation_id, role, content)
    values (v_conversation_id, 'system', 'nope');
    raise exception 'assertion failed: invalid role was allowed';
  exception when check_violation then
    null;
  end;

  -- Blank message content is rejected.
  begin
    insert into public.messages (conversation_id, role, content)
    values (v_conversation_id, 'user', '   ');
    raise exception 'assertion failed: blank content was allowed';
  exception when check_violation then
    null;
  end;

  -- A valid message round-trips.
  insert into public.messages (conversation_id, role, content)
  values (v_conversation_id, 'user', 'Review our architecture.');

  if not exists (
    select 1 from public.messages
    where conversation_id = v_conversation_id
      and role = 'user'
      and content = 'Review our architecture.'
  ) then
    raise exception 'assertion failed: valid message was not stored';
  end if;

  -- Deleting the user cascades to conversations and messages.
  delete from public.users where id = v_user_id;

  if exists (select 1 from public.conversations where id = v_conversation_id) then
    raise exception 'assertion failed: conversation did not cascade on user delete';
  end if;
  if exists (select 1 from public.messages where conversation_id = v_conversation_id) then
    raise exception 'assertion failed: messages did not cascade on user delete';
  end if;
end $$;

-- Index exists ---------------------------------------------------------------
select pg_temp.assert_true(
  to_regclass('public.messages_conversation_order_idx') is not null,
  'messages ordering index exists'
);
