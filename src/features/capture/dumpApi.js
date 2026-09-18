import { supabase } from "../../lib/supabase";
import { getCurrentUserId, getFollowingIds } from "../social/socialApi.js";
import { hydrateMusicTracks } from "../music/musicApi.js";

export async function createDump({
  type = "dump",
  spaceId,
  mood,
  expiry,
  context = null,
  frameCount = null,
  items = [],
  musicTrackId = null,
  location = null,
  taggedUserIds = [],
}) {
  const userId = await getCurrentUserId();

  const { data: dump, error: dumpError } = await supabase
    .from("dumps")
    .insert({
      user_id: userId,
      space_id: spaceId,
      type,
      mood,
      expiry,
      context,
      frame_count: frameCount,
      music_track_id: musicTrackId,
      location_name: location?.name || null,
      location_city: location?.city || null,
      location_lat: Number.isFinite(Number(location?.latitude)) ? Number(location.latitude) : null,
      location_lng: Number.isFinite(Number(location?.longitude)) ? Number(location.longitude) : null,
      location_place_id: location?.placeId || null,
    })
    .select()
    .single();

  if (dumpError) {
    throw dumpError;
  }

  if (items.length > 0) {
    const dumpItems = items.map((item, index) => ({
      dump_id: dump.id,
      position: index,
      note: item.note || "",
      image_path: item.imagePath || null,
    }));

    const { error: itemsError } = await supabase
      .from("dump_items")
      .insert(dumpItems);

    if (itemsError) {
      await supabase.from("dumps").delete().eq("id", dump.id);
      throw itemsError;
    }
  }

  const cleanTagIds = Array.from(
    new Set((taggedUserIds || []).map((id) => String(id).trim()).filter(Boolean)),
  )
    .filter((id) => id !== userId)
    .slice(0, 10);

  if (cleanTagIds.length) {
    const { error: tagsError } = await supabase
      .from("dump_tags")
      .insert(cleanTagIds.map((taggedUserId) => ({
        dump_id: dump.id,
        tagged_user_id: taggedUserId,
        tagged_by_user_id: userId,
      })));

    if (tagsError) {
      await supabase.from("dumps").delete().eq("id", dump.id);
      throw tagsError;
    }
  }

  return dump;
}

export async function getFeedDumps({ limit = 50, spaceId = null } = {}) {
  const userId = await getCurrentUserId();
  const following = await getFollowingIds();
  const followedIds = Object.entries(following)
    .filter(([, status]) => status === "accepted")
    .map(([id]) => id);
  const feedUserIds = [userId, ...followedIds];

  let query = supabase
    .from("dumps")
    .select(`
      *,
      dump_items (
        id,
        position,
        note,
        image_path
      ),
      music_tracks:music_track_id (
        id,
        title,
        artist,
        cover_url,
        audio_url,
        genre,
        mood,
        duration,
        provider,
        provider_track_id
      ),
      dump_tags (
        tagged_user_id,
        tagged_user:tagged_user_id (
          id,
          username,
          display_name,
          avatar_url
        )
      )
    `)
    .in("user_id", feedUserIds)
    .order("created_at", { ascending: false });

  if (spaceId) {
    query = query.eq("space_id", spaceId);
  }

  const { data, error } = await query.limit(Math.max(1, Math.min(limit, 100)));

  if (error) {
    throw error;
  }

  if (data?.length) {
    const hydratedTracks = await hydrateMusicTracks(
      data.map((dump) => dump.music_tracks).filter(Boolean),
    );
    const trackById = new Map(hydratedTracks.map((track) => [track.id, track]));
    return data.map((dump) => ({
      ...dump,
      music_tracks: dump.music_tracks ? trackById.get(dump.music_tracks.id) || dump.music_tracks : null,
    }));
  }

  return data || [];
}

export async function getDumps() {
  const { data, error } = await supabase
    .from("dumps")
    .select(`
      *,
      dump_items (
        id,
        position,
        note,
        image_path
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}


export async function getDumpById(dumpId) {
  if (!dumpId) return null;

  const { data, error } = await supabase
    .from("dumps")
    .select(`
      *,
      dump_items (
        id,
        position,
        note,
        image_path
      ),
      music_tracks:music_track_id (
        id,
        title,
        artist,
        cover_url,
        audio_url,
        genre,
        mood,
        duration,
        provider,
        provider_track_id
      ),
      dump_tags (
        tagged_user_id,
        tagged_user:tagged_user_id (
          id,
          username,
          display_name,
          avatar_url
        )
      )
    `)
    .eq("id", dumpId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const hydratedTracks = data.music_tracks
    ? await hydrateMusicTracks([data.music_tracks])
    : [];

  return {
    ...data,
    music_tracks: hydratedTracks[0] || data.music_tracks || null,
  };
}
