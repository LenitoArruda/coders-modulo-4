-- Schema tests for optional RAG citation metadata on messages.
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

select pg_temp.assert_true(
  (select data_type from information_schema.columns
   where table_schema = 'public' and table_name = 'messages'
     and column_name = 'citations') = 'jsonb',
  'messages.citations is jsonb'
);
select pg_temp.assert_true(
  (select data_type from information_schema.columns
   where table_schema = 'public' and table_name = 'messages'
     and column_name = 'retrieval') = 'jsonb',
  'messages.retrieval is jsonb'
);
select pg_temp.assert_true(
  (select data_type from information_schema.columns
   where table_schema = 'public' and table_name = 'messages'
     and column_name = 'answer_status') = 'text',
  'messages.answer_status is text'
);
select pg_temp.assert_true(
  exists (
    select 1 from pg_constraint
    where conname = 'messages_answer_status_check'
      and conrelid = 'public.messages'::regclass
      and contype = 'c'
  ),
  'answer status constraint exists'
);

do $$
declare
  v_user uuid;
  v_conversation uuid;
  v_message uuid;
begin
  insert into public.users (first_name, last_name, email, password_hash)
  values ('Ada', 'Lovelace', 'ada.citations@example.com', 'seed-password-hash-with-32-chars')
  returning id into v_user;

  insert into public.conversations (user_id, expert_id)
  values (v_user, 'cto')
  returning id into v_conversation;

  -- Old-style insert keeps every new column null.
  insert into public.messages (conversation_id, role, content)
  values (v_conversation, 'user', 'Old style message');

  if exists (
    select 1 from public.messages
    where conversation_id = v_conversation and role = 'user'
      and (citations is not null or retrieval is not null or answer_status is not null)
  ) then
    raise exception 'assertion failed: legacy message was changed';
  end if;

  insert into public.messages
    (conversation_id, role, content, citations, retrieval, answer_status)
  values (
    v_conversation,
    'expert',
    'The plan says [1].',
    jsonb_build_array(
      jsonb_build_object(
        'citationNumber', 1,
        'sourceId', '11111111-1111-1111-1111-111111111111',
        'sourceVersionId', '22222222-2222-2222-2222-222222222222',
        'chunkIndex', 0,
        'sourceName', 'plan.txt',
        'sourceType', 'txt',
        'location', jsonb_build_object('label', 'Chunk 1'),
        'snippet', 'The plan says to ship small batches.',
        'isStale', false,
        'sourceRemoved', false
      )
    ),
    jsonb_build_object(
      'queryEmbeddingModel', 'text-embedding-3-small',
      'vectorIndex', 'KnowledgeChunk',
      'topK', 5,
      'threshold', 0.35,
      'scores', jsonb_build_array(0.9),
      'latencyMs', 12,
      'chunksConsidered', 1,
      'status', 'matched'
    ),
    'with_source'
  )
  returning id into v_message;

  perform pg_temp.assert_true(
    (select citations -> 0 ->> 'sourceName' from public.messages where id = v_message)
      = 'plan.txt',
    'citation metadata round-trips'
  );
  perform pg_temp.assert_true(
    (select retrieval ->> 'vectorIndex' from public.messages where id = v_message)
      = 'KnowledgeChunk',
    'retrieval metadata round-trips'
  );

  begin
    insert into public.messages
      (conversation_id, role, content, answer_status)
    values (v_conversation, 'expert', 'Invalid state', 'invented');
    raise exception 'assertion failed: invalid answer status was allowed';
  exception
    when check_violation then
      null;
  end;
end $$;
