-- STAGING ONLY: reviewed schema-only completion for the limited bootstrap.
-- Apply only through the exact-project guard for ljcfoanzmowgkjtrdcgg.
-- Not a production migration and not an export of the live database.
-- No users, content, media, licenses, or catalog rows are copied by this file.
-- Caller owns the transaction so a role-test rehearsal can ROLLBACK first.
do $$
begin
  if not exists (select 1 from public.__flicd_staging_marker
                 where label='SYNTHETIC_STAGING_ONLY') then
    raise exception 'Refusing schema completion without the isolated staging marker';
  end if;
end $$;

alter table public.__flicd_staging_marker enable row level security;
revoke all on public.__flicd_staging_marker from public, anon, authenticated;

-- Fields used by current React queries, absent from the limited bootstrap.
alter table public.profiles
  add column if not exists display_name text not null default '',
  add column if not exists bio text not null default '',
  add column if not exists avatar_url text,
  add column if not exists profile_theme jsonb,
  add column if not exists interests text[] not null default '{}',
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists created_at timestamptz not null default now();
alter table public.follows add column if not exists created_at timestamptz not null default now();
alter table public.dumps
  add column if not exists context text,
  add column if not exists frame_count integer;
alter table public.dump_items add column if not exists mood text not null default '';
alter table public.boards
  add column if not exists description text,
  add column if not exists cover_url text,
  add column if not exists pinned boolean not null default false,
  add column if not exists style_config jsonb not null default '{}',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();
alter table public.board_items
  add column if not exists note text not null default '',
  add column if not exists mood text not null default '',
  add column if not exists saved_author_username text,
  add column if not exists created_at timestamptz not null default now();
create unique index if not exists board_items_owner_board_dump_position_key
  on public.board_items(user_id,board_id,dump_id,item_position);

-- Named profile relationships required by PostgREST embedded DM queries.
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.message_requests'::regclass
                 and conname='message_requests_sender_profile_fkey') then
    alter table public.message_requests add constraint message_requests_sender_profile_fkey
      foreign key(sender_id) references public.profiles(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.conversation_participants'::regclass
                 and conname='conversation_participants_profile_fkey') then
    alter table public.conversation_participants add constraint conversation_participants_profile_fkey
      foreign key(user_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

-- Restore only owner-scoped writes missing from this bootstrap.
grant insert,update on public.profiles to authenticated;
drop policy if exists "Staging owner creates profile" on public.profiles;
create policy "Staging owner creates profile" on public.profiles for insert to authenticated
  with check(id=(select auth.uid()));
drop policy if exists "Staging owner updates profile" on public.profiles;
create policy "Staging owner updates profile" on public.profiles for update to authenticated
  using(id=(select auth.uid())) with check(id=(select auth.uid()));

grant insert,update,delete on public.boards,public.board_items to authenticated;
drop policy if exists "Staging owner creates boards" on public.boards;
create policy "Staging owner creates boards" on public.boards for insert to authenticated
  with check(user_id=(select auth.uid()));
drop policy if exists "Staging owner updates boards" on public.boards;
create policy "Staging owner updates boards" on public.boards for update to authenticated
  using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists "Staging owner deletes boards" on public.boards;
create policy "Staging owner deletes boards" on public.boards for delete to authenticated
  using(user_id=(select auth.uid()));
drop policy if exists "Staging owner creates board snapshots" on public.board_items;
create policy "Staging owner creates board snapshots" on public.board_items for insert to authenticated
  with check(user_id=(select auth.uid()) and snapshot_bucket='flicd-archive'
    and (saved_image_path is null or split_part(saved_image_path,'/',1)=(select auth.uid())::text)
    and exists(select 1 from public.boards b where b.id=board_id and b.user_id=(select auth.uid())));
drop policy if exists "Staging owner updates board snapshots" on public.board_items;
create policy "Staging owner updates board snapshots" on public.board_items for update to authenticated
  using(user_id=(select auth.uid()))
  with check(user_id=(select auth.uid())
    and (saved_image_path is null or split_part(saved_image_path,'/',1)=(select auth.uid())::text)
    and exists(select 1 from public.boards b where b.id=board_id and b.user_id=(select auth.uid())));
drop policy if exists "Staging owner deletes board snapshots" on public.board_items;
create policy "Staging owner deletes board snapshots" on public.board_items for delete to authenticated
  using(user_id=(select auth.uid()));

-- Accepting still flows exclusively through the reviewed server trigger.
drop policy if exists "Staging sender creates pending requests" on public.message_requests;
create policy "Staging sender creates pending requests" on public.message_requests for insert to authenticated
  with check(sender_id=(select auth.uid()) and recipient_id<>(select auth.uid())
    and status='pending' and responded_at is null);

-- Client archive APIs use UPSERT, including entries already created by the once trigger.
grant update on public.flicd_archive,public.flicd_archive_items to authenticated;
drop policy if exists "Staging owner updates archive entries" on public.flicd_archive;
create policy "Staging owner updates archive entries" on public.flicd_archive for update to authenticated
  using(user_id=(select auth.uid()))
  with check(user_id=(select auth.uid()) and exists(select 1 from public.dumps d
    where d.id=dump_id and d.user_id=(select auth.uid())));
drop policy if exists "Staging owner updates archive items" on public.flicd_archive_items;
create policy "Staging owner updates archive items" on public.flicd_archive_items for update to authenticated
  using(user_id=(select auth.uid()))
  with check(user_id=(select auth.uid()) and exists(select 1 from public.dumps d
    where d.id=dump_id and d.user_id=(select auth.uid())));
drop policy if exists "Staging owner replaces archive objects" on storage.objects;
create policy "Staging owner replaces archive objects" on storage.objects for update to authenticated
  using(bucket_id='flicd-archive' and (storage.foldername(name))[1]=(select auth.uid())::text)
  with check(bucket_id='flicd-archive' and (storage.foldername(name))[1]=(select auth.uid())::text);

notify pgrst, 'reload schema';
