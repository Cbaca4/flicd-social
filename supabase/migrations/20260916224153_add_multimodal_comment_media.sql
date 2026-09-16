alter table public.comments
  alter column text drop not null,
  add column if not exists media_type text not null default 'text',
  add column if not exists media_url text,
  add column if not exists media_path text,
  add column if not exists media_metadata jsonb;

alter table public.comments
  drop constraint if exists comments_text_length,
  add constraint comments_media_type_check check (media_type in ('text', 'gif', 'audio', 'video')),
  add constraint comments_content_check check (
    (media_type = 'text'
      and char_length(trim(coalesce(text, ''))) between 1 and 500
      and media_url is null
      and media_path is null)
    or
    (media_type = 'gif'
      and text is null
      and media_url is not null
      and media_path is null)
    or
    (media_type in ('audio', 'video')
      and text is null
      and media_path is not null
      and media_url is null)
  );

create index if not exists comments_dump_id_created_at_idx
  on public.comments (dump_id, created_at);

create index if not exists comments_media_type_idx
  on public.comments (media_type)
  where media_type <> 'text';
