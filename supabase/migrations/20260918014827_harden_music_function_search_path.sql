create or replace function public.set_music_track_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
