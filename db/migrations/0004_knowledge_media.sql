-- Knowledge media: extends the 013 source contract with image/audio/video
-- types, optional progress and extraction provenance. Additive only: no data
-- migration and no down-migration are performed by bun run db:migrate.

-- Sources and versions now accept the three media types alongside documents.
alter table public.sources
  drop constraint sources_type_check;
alter table public.sources
  add constraint sources_type_check
  check (type in ('pdf', 'txt', 'markdown', 'image', 'audio', 'video'));

alter table public.source_versions
  drop constraint source_versions_type_check;
alter table public.source_versions
  add constraint source_versions_type_check
  check (type in ('pdf', 'txt', 'markdown', 'image', 'audio', 'video'));

alter table public.source_versions
  add column processing_phase text,
  add column media_type text,
  add column duration_seconds integer,
  add column extraction_method text,
  add column extraction_model_version text;

alter table public.source_versions
  add constraint source_versions_processing_phase_check
  check (processing_phase in ('extracting', 'chunking', 'embedding'));
alter table public.source_versions
  add constraint source_versions_media_type_check
  check (media_type in ('image', 'audio', 'video'));
alter table public.source_versions
  add constraint source_versions_duration_check
  check (duration_seconds is null or (duration_seconds > 0 and duration_seconds <= 3600));
alter table public.source_versions
  add constraint source_versions_extraction_method_check
  check (extraction_method in ('ocr', 'transcription'));
alter table public.source_versions
  add constraint source_versions_media_consistency_check
  check (
    (media_type is not null and type = media_type)
    or (media_type is null and type in ('pdf', 'txt', 'markdown'))
  );

comment on column public.source_versions.processing_phase is
  'Optional detail inside processing: extracting, chunking or embedding.';
comment on column public.source_versions.media_type is
  'Original media family; null for PDF, TXT and Markdown sources.';
comment on column public.source_versions.duration_seconds is
  'Client-declared duration in seconds, capped at 60 minutes.';
comment on column public.source_versions.extraction_method is
  'ocr for images, transcription for audio and video.';
comment on column public.source_versions.extraction_model_version is
  'Local OCR/transcription model identifier used for provenance only.';

-- Rollback (manual, local only; not executed by the migration runner):
-- alter table public.source_versions
--   drop constraint source_versions_media_consistency_check,
--   drop constraint source_versions_extraction_method_check,
--   drop constraint source_versions_duration_check,
--   drop constraint source_versions_media_type_check,
--   drop constraint source_versions_processing_phase_check,
--   drop column extraction_model_version,
--   drop column extraction_method,
--   drop column duration_seconds,
--   drop column media_type,
--   drop column processing_phase;
