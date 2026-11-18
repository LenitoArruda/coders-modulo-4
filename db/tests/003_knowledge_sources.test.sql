-- Schema tests for knowledge sources, versions, files and chunks.
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

-- Tables and RLS -------------------------------------------------------------
select pg_temp.assert_true(
  to_regclass('public.sources') is not null,
  'sources table exists'
);
select pg_temp.assert_true(
  to_regclass('public.source_versions') is not null,
  'source_versions table exists'
);
select pg_temp.assert_true(
  to_regclass('public.source_files') is not null,
  'source_files table exists'
);
select pg_temp.assert_true(
  to_regclass('public.source_chunks') is not null,
  'source_chunks table exists'
);

select pg_temp.assert_true(
  (select relrowsecurity from pg_class where oid = 'public.sources'::regclass),
  'sources has RLS enabled'
);
select pg_temp.assert_true(
  (select relrowsecurity from pg_class where oid = 'public.source_versions'::regclass),
  'source_versions has RLS enabled'
);
select pg_temp.assert_true(
  (select relrowsecurity from pg_class where oid = 'public.source_files'::regclass),
  'source_files has RLS enabled'
);
select pg_temp.assert_true(
  (select relrowsecurity from pg_class where oid = 'public.source_chunks'::regclass),
  'source_chunks has RLS enabled'
);
select pg_temp.assert_true(
  (select count(*) from pg_policies where tablename in (
    'sources', 'source_versions', 'source_files', 'source_chunks'
  )) = 0,
  'source tables have no policies'
);
select pg_temp.assert_true(
  to_regclass('public.source_versions_active_hash_unique') is not null,
  'active hash unique index exists'
);

-- Ownership, dedup, versioning and cascade ----------------------------------
do $$
declare
  v_user_a uuid;
  v_user_b uuid;
  v_source uuid;
  v_version_a uuid;
  v_version_b uuid;
  v_hash_a char(64) := repeat('a', 64);
  v_hash_b char(64) := repeat('b', 64);
begin
  insert into public.users (first_name, last_name, email, password_hash)
  values ('Ada', 'Lovelace', 'ada.sources@example.com', 'seed-password-hash-with-32-chars')
  returning id into v_user_a;

  insert into public.users (first_name, last_name, email, password_hash)
  values ('Grace', 'Hopper', 'grace.sources@example.com', 'seed-password-hash-with-32-chars')
  returning id into v_user_b;

  insert into public.sources (user_id, name, normalized_name, type)
  values (v_user_a, 'Relatório.md', 'relatorio.md', 'markdown')
  returning id into v_source;

  insert into public.source_versions
    (source_id, user_id, content_hash, original_name, mime_type, byte_size, type, status)
  values
    (v_source, v_user_a, v_hash_a, 'Relatório.md', 'text/markdown', 24, 'markdown', 'ready')
  returning id into v_version_a;

  update public.sources set current_version_id = v_version_a where id = v_source;

  -- Same hash for the same user with a non-failed version is rejected.
  begin
    insert into public.source_versions
      (source_id, user_id, content_hash, original_name, mime_type, byte_size, type, status)
    values
      (v_source, v_user_a, v_hash_a, 'Relatório.md', 'text/markdown', 24, 'markdown', 'ready');
    raise exception 'assertion failed: duplicate active hash was allowed';
  exception when unique_violation then
    null;
  end;

  -- A failed version can be retried with the same hash.
  insert into public.source_versions
    (source_id, user_id, content_hash, original_name, mime_type, byte_size, type, status)
  values
    (v_source, v_user_a, v_hash_a, 'Relatório.md', 'text/markdown', 24, 'markdown', 'failed');

  -- Dedup is scoped by user: the other account can connect the same bytes.
  declare
    v_source_b uuid;
  begin
    insert into public.sources (user_id, name, normalized_name, type)
    values (v_user_b, 'Relatório.md', 'relatorio.md', 'markdown')
    returning id into v_source_b;

    insert into public.source_versions
      (source_id, user_id, content_hash, original_name, mime_type, byte_size, type, status)
    values
      (v_source_b, v_user_b, v_hash_a, 'Relatório.md', 'text/markdown', 24, 'markdown', 'ready');
  end;

  -- Changed content on the same source creates a new version and makes the
  -- previous one stale (it is no longer the current version).
  insert into public.source_versions
    (source_id, user_id, content_hash, original_name, mime_type, byte_size, type, status)
  values
    (v_source, v_user_a, v_hash_b, 'Relatório.md', 'text/markdown', 32, 'markdown', 'ready')
  returning id into v_version_b;

  update public.sources set current_version_id = v_version_b where id = v_source;

  if exists (
    select 1 from public.sources
    where id = v_source and current_version_id = v_version_a
  ) then
    raise exception 'assertion failed: previous version is still current';
  end if;

  -- Original bytes and chunks round-trip and cascade with the version/source.
  insert into public.source_files (source_version_id, user_id, content, byte_size)
  values (v_version_a, v_user_a, convert_to('old content', 'UTF8'), 11);

  insert into public.source_chunks
    (source_id, source_version_id, user_id, chunk_index, content)
  values (v_source, v_version_a, v_user_a, 0, 'old content');

  if not exists (
    select 1 from public.source_files where source_version_id = v_version_a
  ) then
    raise exception 'assertion failed: original file was not stored';
  end if;

  if not exists (
    select 1 from public.source_chunks
    where source_version_id = v_version_a and chunk_index = 0
  ) then
    raise exception 'assertion failed: chunk was not stored';
  end if;

  delete from public.sources where id = v_source;

  if exists (select 1 from public.source_versions where source_id = v_source) then
    raise exception 'assertion failed: versions did not cascade';
  end if;
  if exists (select 1 from public.source_files where user_id = v_user_a) then
    raise exception 'assertion failed: files did not cascade';
  end if;
  if exists (select 1 from public.source_chunks where user_id = v_user_a) then
    raise exception 'assertion failed: chunks did not cascade';
  end if;

  delete from public.users where id in (v_user_a, v_user_b);
end $$;
