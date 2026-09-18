insert into public.music_licenses (
  provider, license_type, license_id, license_url, territory,
  commercial_use, app_use, streaming_use, user_generated_content,
  attribution_required, license_document_url, notes
)
values (
  'Free Music Archive',
  'CC BY 4.0',
  'CC-BY-4.0',
  'https://creativecommons.org/licenses/by/4.0/',
  'worldwide',
  true, true, true, true,
  true,
  'https://creativecommons.org/licenses/by/4.0/',
  'Individually verified FMA/Ketsa tracks. Attribution required. The provider page is the current source of record.'
)
on conflict do nothing;

insert into public.music_tracks (
  title, artist, audio_url, genre, duration, provider, provider_track_id,
  license_id, active, approved
)
select *
from (
  values
    ('The Road','Ketsa',null,'Soul-RnB / Hip-Hop Beats / Instrumental',174,'Free Music Archive','https://freemusicarchive.org/music/Ketsa/cc-by-free-to-use-for-anything/the-road-1/'),
    ('The Road 2','Ketsa',null,'Soul-RnB / Hip-Hop Beats / Instrumental',197,'Free Music Archive','https://freemusicarchive.org/music/Ketsa/cc-by-free-to-use-for-anything/the-road-2/'),
    ('That Feeling','Ketsa',null,'Soul-RnB / Hip-Hop Beats / Instrumental',187,'Free Music Archive','https://freemusicarchive.org/music/Ketsa/cc-by-free-to-use-for-anything/that-feeling/'),
    ('Feeling','Ketsa',null,'Soul-RnB / Hip-Hop Beats / Instrumental',204,'Free Music Archive','https://freemusicarchive.org/music/Ketsa/cc-by-free-to-use-for-anything/feeling-1/'),
    ('What It Feels Like','Ketsa',null,'Soundtrack / Hip-Hop Beats / Instrumental',205,'Free Music Archive','https://freemusicarchive.org/music/Ketsa/cc-by-free-to-use-for-anything/what-it-feels-like-1/'),
    ('Good Feel','Ketsa',null,'Soundtrack / Hip-Hop Beats / Instrumental',205,'Free Music Archive','https://freemusicarchive.org/music/Ketsa/cc-by-free-to-use-for-anything/good-feel/'),
    ('No Limits','Ketsa',null,'Soundtrack / Hip-Hop Beats / Instrumental',202,'Free Music Archive','https://freemusicarchive.org/music/Ketsa/cc-by-free-to-use-for-anything/no-limits-2/'),
    ('All Out','Ketsa',null,'Jazz / Hip-Hop Beats / Instrumental',188,'Free Music Archive','https://freemusicarchive.org/music/Ketsa/cc-by-free-to-use-for-anything/all-out/'),
    ('Around the Corner','Ketsa',null,'Soundtrack / Ambient Electronic / Instrumental',192,'Free Music Archive','https://freemusicarchive.org/music/Ketsa/cc-by-free-to-use-for-anything/around-the-corner/'),
    ('This Life','Ketsa',null,'Soundtrack / Electroacoustic / Instrumental',197,'Free Music Archive','https://freemusicarchive.org/music/Ketsa/cc-by-free-to-use-for-anything/this-life/')
) as t(title,artist,audio_url,genre,duration,provider,provider_track_id)
cross join lateral (
  select id from public.music_licenses
  where provider = t.provider and license_id = 'CC-BY-4.0'
  limit 1
) l
on conflict (provider, provider_track_id) do update
set title = excluded.title,
    artist = excluded.artist,
    genre = excluded.genre,
    duration = excluded.duration,
    license_id = excluded.license_id,
    active = true,
    approved = true;
