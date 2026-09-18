import { supabase } from "../../lib/supabase";

const TRACK_FIELDS = "id,title,artist,cover_url,audio_url,genre,mood,duration,provider,provider_track_id,license_id,active,approved";

export async function getMusicTracks({ search = "", limit = 50 } = {}) {
  const cleanSearch = search.trim();
  let query = supabase
    .from("music_tracks")
    .select(TRACK_FIELDS)
    .eq("active", true)
    .eq("approved", true)
    .order("artist", { ascending: true })
    .order("title", { ascending: true })
    .limit(Math.max(1, Math.min(limit, 100)));

  if (cleanSearch) {
    const safe = cleanSearch.replace(/[%_]/g, "\\$&");
    query = query.or(
      "title.ilike.%" + safe + "%,artist.ilike.%" + safe + "%,genre.ilike.%" + safe + "%"
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
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
  return data;
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
