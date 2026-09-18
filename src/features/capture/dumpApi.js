import { supabase } from "../../lib/supabase";
import { getCurrentUserId, getFollowingIds } from "../social/socialApi.js";

export async function createDump({
  type = "dump",
  spaceId,
  mood,
  expiry,
  context = null,
  frameCount = null,
  items = [],
  musicTrackId = null,
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
