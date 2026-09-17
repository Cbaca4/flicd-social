alter table public.profiles
  add column if not exists follower_count integer not null default 0,
  add column if not exists following_count integer not null default 0;

alter table public.profiles
  add constraint profiles_follower_count_nonnegative check (follower_count >= 0),
  add constraint profiles_following_count_nonnegative check (following_count >= 0);

create index if not exists follows_following_status_idx
  on public.follows (following_id, status);

create index if not exists follows_follower_status_idx
  on public.follows (follower_id, status);

update public.profiles p
set
  follower_count = coalesce((select count(*) from public.follows f where f.following_id = p.id and f.status = 'accepted'), 0),
  following_count = coalesce((select count(*) from public.follows f where f.follower_id = p.id and f.status = 'accepted'), 0);

create schema if not exists private;

create or replace function private.sync_profile_relationship_counts()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'accepted' then
      update public.profiles
      set follower_count = follower_count + 1
      where id = new.following_id;

      update public.profiles
      set following_count = following_count + 1
      where id = new.follower_id;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.status = 'accepted' then
      update public.profiles
      set follower_count = greatest(0, follower_count - 1)
      where id = old.following_id;

      update public.profiles
      set following_count = greatest(0, following_count - 1)
      where id = old.follower_id;
    end if;
    return old;
  end if;

  if old.status is distinct from new.status then
    if old.status = 'accepted' and new.status <> 'accepted' then
      update public.profiles
      set follower_count = greatest(0, follower_count - 1)
      where id = new.following_id;

      update public.profiles
      set following_count = greatest(0, following_count - 1)
      where id = new.follower_id;
    elsif old.status <> 'accepted' and new.status = 'accepted' then
      update public.profiles
      set follower_count = follower_count + 1
      where id = new.following_id;

      update public.profiles
      set following_count = following_count + 1
      where id = new.follower_id;
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function private.sync_profile_relationship_counts() from public, anon, authenticated;

drop trigger if exists sync_profile_relationship_counts on public.follows;

create trigger sync_profile_relationship_counts
after insert or update of status or delete on public.follows
for each row execute function private.sync_profile_relationship_counts();
