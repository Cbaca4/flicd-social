alter table public.music_licenses add column if not exists attribution_text text;
alter table public.music_tracks add column if not exists source_url text;

update public.music_licenses
set attribution_text = 'Music by Ketsa.uk'
where provider = 'Free Music Archive' and license_id = 'CC-BY-4.0' and attribution_text is null;

update public.music_tracks
set source_url = provider_track_id
where provider = 'Free Music Archive' and source_url is null;
