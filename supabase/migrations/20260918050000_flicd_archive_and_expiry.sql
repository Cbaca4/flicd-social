-- flic'd archive: move expired/viewed media out of the public feed bucket.
alter table public.dumps add column if not exists once_viewed_at timestamptz;

create table if not exists public.flicd_archive (
  user_id uuid not null references auth.users(id) on delete cascade,
  dump_id uuid not null references public.dumps(id) on delete cascade,
  archived_at timestamptz not null default now(),
  reason text not null check (reason in ('24h_expired','view_once')),
  primary key (user_id, dump_id)
);

alter table public.flicd_archive enable row level security;
grant select, insert on public.flicd_archive to authenticated;
drop policy if exists "Users can view their own archive" on public.flicd_archive;
create policy "Users can view their own archive" on public.flicd_archive for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can create their own archive entries" on public.flicd_archive;
create policy "Users can create their own archive entries" on public.flicd_archive for insert to authenticated
with check ((select auth.uid()) = user_id and exists (select 1 from public.dumps d where d.id = dump_id and d.user_id = (select auth.uid())));
create index if not exists flicd_archive_user_archived_at_idx on public.flicd_archive(user_id, archived_at desc);
create index if not exists flicd_archive_dump_id_idx on public.flicd_archive(dump_id);

create table if not exists public.flicd_archive_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  dump_id uuid not null references public.dumps(id) on delete cascade,
  item_position integer not null check (item_position >= 0),
  archive_path text not null,
  archived_at timestamptz not null default now(),
  primary key (user_id, dump_id, item_position)
);

alter table public.flicd_archive_items enable row level security;
grant select, insert on public.flicd_archive_items to authenticated;
drop policy if exists "Users can view their own archive media" on public.flicd_archive_items;
create policy "Users can view their own archive media" on public.flicd_archive_items for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can create their own archive media" on public.flicd_archive_items;
create policy "Users can create their own archive media" on public.flicd_archive_items for insert to authenticated
with check ((select auth.uid()) = user_id and exists (select 1 from public.dumps d where d.id = dump_id and d.user_id = (select auth.uid())));
create index if not exists flicd_archive_items_dump_idx on public.flicd_archive_items(dump_id, item_position);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('flicd-archive', 'flicd-archive', false, 52428800, array['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public = false, file_size_limit = 52428800, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read their own Flicd archive media" on storage.objects;
create policy "Users can read their own Flicd archive media" on storage.objects for select to authenticated
using (bucket_id = 'flicd-archive' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Users can upload their own Flicd archive media" on storage.objects;
create policy "Users can upload their own Flicd archive media" on storage.objects for insert to authenticated
with check (bucket_id = 'flicd-archive' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Users can delete their own Flicd archive media" on storage.objects;
create policy "Users can delete their own Flicd archive media" on storage.objects for delete to authenticated
using (bucket_id = 'flicd-archive' and (storage.foldername(name))[1] = (select auth.uid())::text);

create schema if not exists private;
create schema if not exists private;
create or replace function private.handle_dump_view_archive()
returns trigger language plpgsql security definer set search_path = public, pg_catalog
as $$
declare
  dump_owner uuid;
begin
  select d.user_id into dump_owner
    from public.dumps d
   where d.id = new.dump_id
     and d.expiry = 'once'
     and d.once_viewed_at is null
     and (
       d.user_id = new.user_id
       or exists (
         select 1 from public.follows f
          where f.follower_id = new.user_id
            and f.following_id = d.user_id
            and f.status = 'accepted'
       )
     );
  if dump_owner is null then return new; end if;
  update public.dumps set once_viewed_at = coalesce(once_viewed_at, now())
   where id = new.dump_id and expiry = 'once' and once_viewed_at is null;
  insert into public.flicd_archive (user_id, dump_id, reason)
  values (dump_owner, new.dump_id, 'view_once')
  on conflict (user_id, dump_id) do nothing;
  return new;
end;
$$;

drop trigger if exists dump_views_archive_once on public.dump_views;
create trigger dump_views_archive_once after insert on public.dump_views for each row execute function private.handle_dump_view_archive();
create index if not exists dumps_once_viewed_at_idx on public.dumps(once_viewed_at) where expiry = 'once';