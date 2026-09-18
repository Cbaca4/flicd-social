import { supabase } from "../../lib/supabase";

const TRACK_FIELDS = "id,title,artist,cover_url,audio_url,genre,mood,duration,provider,provider_track_id,license_id,active,approved";

async function withPlayableAudio(track) {
  if (!track?.audio_url || track.provider !== "Free Music Archive") return track;
  const { data, error } = await supabase.storage.from("flicd-music").createSignedUrl(track.audio_url, 60 * 60);
  if (error) return { ...track, audio_url: null };
  return { ...track, audio_url: data?.signedUrl || null };
}

async function withPlayableAudioList(tracks) {
  return Promise.all((tracks || []).map(withPlayableAudio));
}

export async function hydrateMusicTracks(tracks) {
  return withPlayableAudioList(tracks);
}

export async function getMusicTracks({ search = "", limit = 50 } = {}) {
  const maxResults = Math.max(1, Math.min(limit, 100));
  const cleanSearch = String(search || "").trim();

  const buildBaseQuery = () => supabase
    .from("music_tracks")
    .select(TRACK_FIELDS)
    .eq("active", true)
    .eq("approved", true);

  let tracks = [];

  if (!cleanSearch) {
    const { data, error } = await buildBaseQuery()
      .order("artist", { ascending: true })
      .order("title", { ascending: true })
      .limit(maxResults);

    if (error) throw error;
    tracks = data || [];
  } else {
    const pattern = "%" + cleanSearch.replace(/[\\%_]/g, "\\const pattern = "%" + cleanSearch.replace(/[\\%_]/g, "\\\\$&") + "%";") + "%";
    const columns = ["title", "artist", "genre"];

    const results = await Promise.all(columns.map(async (column) => {
      const { data, error } = await buildBaseQuery()
        .ilike(column, pattern)
        .order("artist", { ascending: true })
        .order("title", { ascending: true })
        .limit(maxResults);

      if (error) throw error;
      return data || [];
    }));

    const byId = new Map();
    results.flat().forEach((track) => byId.set(track.id, track));
    tracks = Array.from(byId.values())
      .sort((a, b) =>
        String(a.artist || "").localeCompare(String(b.artist || "")) ||
        String(a.title || "").localeCompare(String(b.title || ""))
      )
      .slice(0, maxResults);
  }

  return withPlayableAudioList(tracks);
}
export async function getMusicTrack(trackId) {
  if (!trackId) return null;
  const { data, error } = await supabase
    .from("music_tracks")
    .select(TRACK_FIELDS)
    .eq("id", trackId)
    .eq("active", true)
    .eq("approved", true)
    .maybeSingle();

  if (error) throw error;
  return withPlayableAudio(data);
}

export async function setProfileMusicTrack(trackId) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData?.user?.id;
  if (!userId) throw new Error("You must be signed in to change profile music.");

  if (trackId && !(await getMusicTrack(trackId))) {
    throw new Error("That track is no longer available.");
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ profile_music_track_id: trackId || null })
    .eq("id", userId)
    .select("id,profile_music_track_id")
    .single();

  if (error) throw error;
  return data;
}
