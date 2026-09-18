create table if not exists public.music_licenses (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  license_type text not null,
  license_id text,
  license_url text,
  verified_at timestamptz not null default now(),
  territory text not null default 'worldwide',
  commercial_use boolean not null default false,
  app_use boolean not null default false,
  streaming_use boolean not null default false,
  user_generated_content boolean not null default false,
  attribution_required boolean not null default false,
  license_document_url text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.music_tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text not null,
  cover_url text,
  audio_url text,
  genre text,
  mood text,
  duration integer not null default 0 check (duration >= 0),
  provider text not null,
  provider_track_id text not null,
  license_id uuid not null references public.music_licenses(id) on delete restrict,
  active boolean not null default false,
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_track_id)
);

create index if not exists music_tracks_active_idx on public.music_tracks (active, approved) where active = true and approved = true;
create index if not exists music_tracks_artist_idx on public.music_tracks (artist);
create index if not exists music_tracks_genre_idx on public.music_tracks (genre);
create index if not exists music_tracks_mood_idx on public.music_tracks (mood);

alter table public.profiles add column if not exists profile_music_track_id uuid references public.music_tracks(id) on delete set null;
alter table public.dumps add column if not exists music_track_id uuid references public.music_tracks(id) on delete set null;

create index if not exists profiles_profile_music_track_idx on public.profiles (profile_music_track_id) where profile_music_track_id is not null;
create index if not exists dumps_music_track_idx on public.dumps (music_track_id) where music_track_id is not null;

create or replace function public.set_music_track_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists music_tracks_set_updated_at on public.music_tracks;
create trigger music_tracks_set_updated_at before update on public.music_tracks
for each row execute function public.set_music_track_updated_at();

alter table public.music_licenses enable row level security;
alter table public.music_tracks enable row level security;

drop policy if exists "Authenticated users can read music licenses" on public.music_licenses;
create policy "Authenticated users can read music licenses" on public.music_licenses for select to authenticated using (true);

drop policy if exists "Authenticated users can read active approved music" on public.music_tracks;
create policy "Authenticated users can read active approved music" on public.music_tracks for select to authenticated using (active = true and approved = true);
