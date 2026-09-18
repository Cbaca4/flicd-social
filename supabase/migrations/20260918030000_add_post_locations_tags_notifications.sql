alter table public.dumps
  add column if not exists location_name text,
  add column if not exists location_city text,
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision,
  add column if not exists location_place_id text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'dumps_location_lat_valid') then
    alter table public.dumps
      add constraint dumps_location_lat_valid
      check (location_lat is null or location_lat between -90 and 90);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dumps_location_lng_valid') then
    alter table public.dumps
      add constraint dumps_location_lng_valid
      check (location_lng is null or location_lng between -180 and 180);
  end if;
end $$;

create table if not exists public.dump_tags (
  dump_id uuid not null references public.dumps(id) on delete cascade,
  tagged_user_id uuid not null references public.profiles(id) on delete cascade,
  tagged_by_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (dump_id, tagged_user_id),
  constraint dump_tags_not_self check (tagged_user_id <> tagged_by_user_id)
);

create index if not exists dump_tags_tagged_user_idx on public.dump_tags (tagged_user_id, created_at desc);
create index if not exists dump_tags_dump_idx on public.dump_tags (dump_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null,
  dump_id uuid references public.dumps(id) on delete cascade,
  body text,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_type_valid check (type = any (array['dump_tag'::text]))
);

create index if not exists notifications_recipient_created_idx on public.notifications (recipient_id, created_at desc);
create index if not exists notifications_recipient_unread_idx on public.notifications (recipient_id, read_at, created_at desc);

alter table public.dump_tags enable row level security;
alter table public.notifications enable row level security;

revoke all on table public.dump_tags, public.notifications from anon, authenticated;
grant select, insert, delete on table public.dump_tags to authenticated;
grant select, update on table public.notifications to authenticated;

drop policy if exists "Users can view tags on visible dumps" on public.dump_tags;
create policy "Users can view tags on visible dumps" on public.dump_tags for select to authenticated using (
  exists (
    select 1 from public.dumps d
    where d.id = dump_tags.dump_id
      and (
        d.user_id = (select auth.uid())
        or exists (select 1 from public.profiles p where p.id = d.user_id and p.is_private = false)
        or exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.following_id = d.user_id and f.status = 'accepted')
      )
  )
);

drop policy if exists "Users can tag users on their own dumps" on public.dump_tags;
create policy "Users can tag users on their own dumps" on public.dump_tags for insert to authenticated with check (
  (select auth.uid()) = tagged_by_user_id
  and tagged_user_id <> (select auth.uid())
  and exists (select 1 from public.dumps d where d.id = dump_tags.dump_id and d.user_id = (select auth.uid()))
);

drop policy if exists "Owners can remove tags from their dumps" on public.dump_tags;
create policy "Owners can remove tags from their dumps" on public.dump_tags for delete to authenticated using (
  exists (select 1 from public.dumps d where d.id = dump_tags.dump_id and d.user_id = (select auth.uid()))
);

drop policy if exists "Recipients can view their notifications" on public.notifications;
create policy "Recipients can view their notifications" on public.notifications for select to authenticated using ((select auth.uid()) = recipient_id);

drop policy if exists "Recipients can mark their notifications read" on public.notifications;
create policy "Recipients can mark their notifications read" on public.notifications for update to authenticated using ((select auth.uid()) = recipient_id) with check ((select auth.uid()) = recipient_id);

create schema if not exists private;

create or replace function private.create_dump_tag_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  actor_name text;
begin
  select coalesce(username, 'someone') into actor_name from public.profiles where id = new.tagged_by_user_id;
  insert into public.notifications (recipient_id, actor_id, type, dump_id, body, payload)
  values (
    new.tagged_user_id,
    new.tagged_by_user_id,
    'dump_tag',
    new.dump_id,
    '@' || actor_name || ' tagged you in a dump',
    jsonb_build_object('actor_username', actor_name, 'dump_id', new.dump_id)
  );
  return new;
end;
$$;

revoke execute on function private.create_dump_tag_notification() from public, anon, authenticated;

drop trigger if exists create_dump_tag_notification on public.dump_tags;
create trigger create_dump_tag_notification
after insert on public.dump_tags
for each row execute function private.create_dump_tag_notification();

create or replace function public.get_profile_followers(target_profile_id uuid)
returns table (id uuid, username text, display_name text, avatar_url text, is_private boolean)
language sql security definer set search_path = public, pg_catalog
as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.is_private
  from public.follows f
  join public.profiles p on p.id = f.follower_id
  where f.following_id = target_profile_id
    and f.status = 'accepted'
    and (
      target_profile_id = (select auth.uid())
      or exists (select 1 from public.profiles target where target.id = target_profile_id and target.is_private = false)
      or exists (select 1 from public.follows viewer_follow where viewer_follow.follower_id = (select auth.uid()) and viewer_follow.following_id = target_profile_id and viewer_follow.status = 'accepted')
    )
  order by lower(p.username), p.id;
$$;

create or replace function public.get_profile_following(target_profile_id uuid)
returns table (id uuid, username text, display_name text, avatar_url text, is_private boolean)
language sql security definer set search_path = public, pg_catalog
as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.is_private
  from public.follows f
  join public.profiles p on p.id = f.following_id
  where f.follower_id = target_profile_id
    and f.status = 'accepted'
    and (
      target_profile_id = (select auth.uid())
      or exists (select 1 from public.profiles target where target.id = target_profile_id and target.is_private = false)
      or exists (select 1 from public.follows viewer_follow where viewer_follow.follower_id = (select auth.uid()) and viewer_follow.following_id = target_profile_id and viewer_follow.status = 'accepted')
    )
  order by lower(p.username), p.id;
$$;

revoke execute on function public.get_profile_followers(uuid) from public, anon;
revoke execute on function public.get_profile_following(uuid) from public, anon;
grant execute on function public.get_profile_followers(uuid) to authenticated;
grant execute on function public.get_profile_following(uuid) to authenticated;
