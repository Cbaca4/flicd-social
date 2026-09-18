create or replace function public.validate_music_track_assignment()
returns trigger language plpgsql set search_path = public, pg_temp
as $$
begin
  if new.profile_music_track_id is not null and not exists (
    select 1 from public.music_tracks
    where id = new.profile_music_track_id and active = true and approved = true
  ) then
    raise exception 'Music track is not available for assignment';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_validate_music_track on public.profiles;
create trigger profiles_validate_music_track
before insert or update of profile_music_track_id on public.profiles
for each row execute function public.validate_music_track_assignment();

create or replace function public.validate_dump_music_track_assignment()
returns trigger language plpgsql set search_path = public, pg_temp
as $$
begin
  if new.music_track_id is not null and not exists (
    select 1 from public.music_tracks
    where id = new.music_track_id and active = true and approved = true
  ) then
    raise exception 'Music track is not available for assignment';
  end if;
  return new;
end;
$$;

drop trigger if exists dumps_validate_music_track on public.dumps;
create trigger dumps_validate_music_track
before insert or update of music_track_id on public.dumps
for each row execute function public.validate_dump_music_track_assignment();
