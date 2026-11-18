-- Schema tests for knowledge media extensions. Rolled back by scripts/db.mjs.

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
  (select count(*) from information_schema.columns
   where table_schema = 'public' and table_name = 'source_versions'
     and column_name in (
       'processing_phase', 'media_type', 'duration_seconds',
       'extraction_method', 'extraction_model_version'
     )) = 5,
  'media provenance columns exist'
);

select pg_temp.assert_true(
  (select count(*) from pg_constraint
   where conrelid = 'public.source_versions'::regclass
     and conname in (
       'source_versions_processing_phase_check',
       'source_versions_media_type_check',
       'source_versions_duration_check',
       'source_versions_extraction_method_check',
       'source_versions_media_consistency_check'
     )) = 5,
  'media constraints exist'
);

do $$
declare
  v_user_a uuid;
  v_user_b uuid;
  v_source_a uuid;
  v_source_b uuid;
  v_version uuid;
  v_hash char(64) := repeat('c', 64);
begin
  insert into public.users (first_name, last_name, email, password_hash)
  values ('Media', 'Tester', 'media.a@example.com', 'seed-password-hash-with-32-chars')
  returning id into v_user_a;

  insert into public.users (first_name, last_name, email, password_hash)
  values ('Media', 'Other', 'media.b@example.com', 'seed-password-hash-with-32-chars')
  returning id into v_user_b;

  insert into public.sources (user_id, name, normalized_name, type)
  values (v_user_a, 'meeting.mp3', 'meeting.mp3', 'audio')
  returning id into v_source_a;

  insert into public.source_versions
    (source_id, user_id, content_hash, original_name, mime_type, byte_size,
     type, status, media_type, duration_seconds, processing_phase)
  values
    (v_source_a, v_user_a, v_hash, 'meeting.mp3', 'audio/mpeg', 1024,
     'audio', 'processing', 'audio', 300, 'extracting')
  returning id into v_version;

  if not exists (
    select 1 from public.source_versions
    where id = v_version
      and media_type = 'audio'
      and duration_seconds = 300
      and processing_phase = 'extracting'
  ) then
    raise exception 'assertion failed: media metadata was not stored';
  end if;

  update public.source_versions
     set processing_phase = 'chunking',
         extraction_method = 'transcription',
         extraction_model_version = 'local-v1'
   where id = v_version;

  if not exists (
    select 1 from public.source_versions
    where id = v_version and processing_phase = 'chunking'
      and extraction_method = 'transcription'
  ) then
    raise exception 'assertion failed: progress phases were not stored';
  end if;

  -- Same hash for another user stays isolated, as in the 013 contract.
  insert into public.sources (user_id, name, normalized_name, type)
  values (v_user_b, 'meeting.mp3', 'meeting.mp3', 'audio')
  returning id into v_source_b;

  insert into public.source_versions
    (source_id, user_id, content_hash, original_name, mime_type, byte_size,
     type, status, media_type)
  values
    (v_source_b, v_user_b, v_hash, 'meeting.mp3', 'audio/mpeg', 1024,
     'audio', 'ready', 'audio');

  -- Duplicate active hash inside one user is still rejected.
  begin
    insert into public.source_versions
      (source_id, user_id, content_hash, original_name, mime_type, byte_size,
       type, status, media_type)
    values
      (v_source_a, v_user_a, v_hash, 'meeting.mp3', 'audio/mpeg', 1024,
       'audio', 'ready', 'audio');
    raise exception 'assertion failed: duplicate media hash was allowed';
  exception when unique_violation then
    null;
  end;

  -- Invalid provenance is rejected by the schema.
  begin
    update public.source_versions
       set processing_phase = 'unknown' where id = v_version;
    raise exception 'assertion failed: invalid phase was allowed';
  exception when check_violation then
    null;
  end;

  begin
    update public.source_versions
       set duration_seconds = 3601 where id = v_version;
    raise exception 'assertion failed: duration above 60 minutes was allowed';
  exception when check_violation then
    null;
  end;

  begin
    update public.source_versions
       set media_type = 'video' where id = v_version;
    raise exception 'assertion failed: inconsistent media type was allowed';
  exception when check_violation then
    null;
  end;

  -- Deleting the source cascades versions/files/chunks but not chat history.
  update public.sources set current_version_id = v_version where id = v_source_a;
  insert into public.source_files (source_version_id, user_id, content, byte_size)
  values (v_version, v_user_a, convert_to('media bytes', 'UTF8'), 11);
  insert into public.source_chunks
    (source_id, source_version_id, user_id, chunk_index, content)
  values (v_source_a, v_version, v_user_a, 0, 'transcribed text');

  delete from public.sources where id = v_source_a;

  if exists (select 1 from public.source_versions where id = v_version) then
    raise exception 'assertion failed: media version did not cascade';
  end if;
  if exists (select 1 from public.source_files where user_id = v_user_a) then
    raise exception 'assertion failed: media file did not cascade';
  end if;
  if exists (select 1 from public.source_chunks where user_id = v_user_a) then
    raise exception 'assertion failed: media chunks did not cascade';
  end if;
  perform pg_temp.assert_true(
    to_regclass('public.conversations') is not null,
    'chat history tables are untouched'
  );

  delete from public.users where id in (v_user_a, v_user_b);
end $$;
