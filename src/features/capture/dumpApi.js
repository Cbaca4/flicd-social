import { supabase, createAccountClient } from "../../lib/supabase";
import { captureAuthScope } from "../../app/authScope.js";
import { getCurrentUserId, getFollowingIds } from "../social/socialApi.js";
import { hydrateMusicTracks } from "../music/musicApi.js";


export const MAX_POSTS_PER_24_HOURS = 3;

export async function getPostingLimitStatus() {
  const userId = await getCurrentUserId();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("dumps")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gt("created_at", cutoff);

  if (error) throw error;

  const used = Number(count || 0);
  return {
    used,
    limit: MAX_POSTS_PER_24_HOURS,
    remaining: Math.max(0, MAX_POSTS_PER_24_HOURS - used),
  };
}

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
  allowOthersToKeep = false,
}, authScope) {
  const scope = captureAuthScope(authScope), client = createAccountClient(scope);
  const { assertCurrent } = scope;
  const userId = await getCurrentUserId();
  scope.assertUser(userId);

  const { data: dump, error: dumpError } = await client
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
      allow_others_to_keep: expiry === "24h" && Boolean(allowOthersToKeep),
      location_name: location?.name || null,
      location_city: location?.city || null,
      location_lat: Number.isFinite(Number(location?.latitude)) ? Number(location.latitude) : null,
      location_lng: Number.isFinite(Number(location?.longitude)) ? Number(location.longitude) : null,
      location_place_id: location?.placeId || null,
    })
    .select()
    .single();

  assertCurrent();
  if (dumpError) {
    throw dumpError;
  }

  const dumpItems = items.map((item, index) => ({
      id: crypto.randomUUID(),
      dump_id: dump.id,
      position: index,
      note: item.note || "",
      image_path: item.imagePath || null,
      media_bucket: item.mediaBucket || "flicd-dump-private",
    }));
  if (dumpItems.length > 0) {
    const { error: itemsError } = await client
      .from("dump_items")
      .insert(dumpItems);

    assertCurrent();
    if (itemsError) {
      await client.from("dumps").delete().eq("id", dump.id);
      throw itemsError;
    }
  }

  const cleanTagIds = Array.from(
    new Set((taggedUserIds || []).map((id) => String(id).trim()).filter(Boolean)),
  )
    .filter((id) => id !== userId)
    .slice(0, 10);

  if (cleanTagIds.length) {
    const { error: tagsError } = await client
      .from("dump_tags")
      .insert(cleanTagIds.map((taggedUserId) => ({
        dump_id: dump.id,
        tagged_user_id: taggedUserId,
        tagged_by_user_id: userId,
      })));

    assertCurrent();
    if (tagsError) {
      await client.from("dumps").delete().eq("id", dump.id);
      throw tagsError;
    }
  }

  return { ...dump, dump_items: dumpItems };
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
        image_path,
        media_bucket
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

  const expiryCutoff = Date.now() - 24 * 60 * 60 * 1000;
  const liveDumps = (data || []).filter((dump) => {
    if (dump.expiry !== "24h") return true;
    if (!dump.created_at) return true;
    const createdAt = new Date(dump.created_at).getTime();
    return Number.isNaN(createdAt) || createdAt > expiryCutoff;
  });

  if (liveDumps.length) {
    const [hydratedTracks, viewsResult] = await Promise.all([
      hydrateMusicTracks(liveDumps.map((dump) => dump.music_tracks).filter(Boolean)),
      supabase.from("dump_views").select("dump_id").eq("user_id", userId).in("dump_id", liveDumps.map((dump) => dump.id)),
    ]);

    if (viewsResult.error) throw viewsResult.error;

    const trackById = new Map(hydratedTracks.map((track) => [track.id, track]));
    const viewedIds = new Set((viewsResult.data || []).map((row) => row.dump_id));

    return liveDumps
      .map((dump) => ({
        ...dump,
        ...(dump.expiry === "once" ? { viewed: viewedIds.has(dump.id) } : {}),
        ...(dump.music_tracks
          ? { music_tracks: trackById.get(dump.music_tracks.id) || dump.music_tracks }
          : {}),
      }));
  }

  return [];
}

export async function markDumpViewed(dumpId, receipt) {
  // UI acknowledgement only. The gateway has already committed the database
  // claim; this helper grants no media access and never writes consumption.
  return Boolean(dumpId && receipt?.dump_id === dumpId &&
    ["claimed", "recovered"].includes(receipt.status) &&
    typeof receipt.claim_id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(receipt.claim_id));
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
        image_path,
        media_bucket
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
        image_path,
        media_bucket
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

  const userId = await getCurrentUserId();
  const { data: view, error: viewError } = await supabase
    .from("dump_views")
    .select("dump_id")
    .eq("dump_id", dumpId)
    .eq("user_id", userId)
    .maybeSingle();

  if (viewError) throw viewError;

  if (
    data.expiry === "24h" &&
    new Date(data.created_at || 0).getTime() <= Date.now() - 24 * 60 * 60 * 1000
  ) {
    return null;
  }

  return {
    ...data,
    ...(data.expiry === "once" ? { viewed: Boolean(view) } : {}),
    ...(data.music_tracks
      ? { music_tracks: hydratedTracks[0] || data.music_tracks }
      : {}),
  };
}
