import { supabase } from "../../lib/supabase";
import { getCurrentUserId, getFollowingIds } from "../social/socialApi.js";
import { hydrateDumpInteractions } from "../social/interactionsApi.js";
import { hydrateMusicTracks } from "../music/musicApi.js";

const EXPLORE_DUMP_FIELDS = `
  id,
  user_id,
  space_id,
  type,
  mood,
  expiry,
  context,
  frame_count,
  created_at,
  allow_others_to_keep,
  once_viewed_at,
  location_name,
  location_city,
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
`;

function normalizeItems(items) {
  return (items || [])
    .slice()
    .sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
    .map((item) => ({
      id: item.id,
      position: item.position,
      note: item.note || "",
      imagePath: item.image_path || null,
    }));
}

function isLiveDump(dump) {
  if (!dump?.created_at) return true;
  if (dump.expiry === "once") return !dump.once_viewed_at;
  if (dump.expiry === "24h") {
    return new Date(dump.created_at).getTime() > Date.now() - 24 * 60 * 60 * 1000;
  }
  return true;
}

export async function getExploreCandidates({ limit = 90 } = {}) {
  const userId = await getCurrentUserId();

  const [profileResult, following, dumpsResult] = await Promise.all([
    supabase.from("profiles").select("interests").eq("id", userId).maybeSingle(),
    getFollowingIds(),
    supabase
      .from("dumps")
      .select(EXPLORE_DUMP_FIELDS)
      .order("created_at", { ascending: false })
      .limit(Math.max(1, Math.min(limit, 100))),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (dumpsResult.error) throw dumpsResult.error;

  const rawDumps = (dumpsResult.data || []).filter(isLiveDump);
  if (!rawDumps.length) {
    return {
      candidates: [],
      interests: profileResult.data?.interests || [],
      followingIds: new Set(Object.entries(following)
        .filter(([, status]) => status === "accepted")
        .map(([id]) => id)),
    };
  }

  const dumpIds = rawDumps.map((dump) => dump.id);
  const authorIds = Array.from(new Set(rawDumps.map((dump) => dump.user_id).filter(Boolean)));
  const [viewsResult, profilesResult] = await Promise.all([
    supabase
      .from("dump_views")
      .select("dump_id")
      .eq("user_id", userId)
      .in("dump_id", dumpIds),
    supabase
      .from("profiles")
      .select("id,username,display_name,avatar_url,interests,is_private")
      .in("id", authorIds),
  ]);

  if (viewsResult.error) throw viewsResult.error;
  if (profilesResult.error) throw profilesResult.error;

  const viewedIds = new Set((viewsResult.data || []).map((row) => row.dump_id));
  const profilesById = new Map((profilesResult.data || []).map((profile) => [profile.id, profile]));
  const publicDumps = rawDumps.filter((dump) => {
    if (dump.user_id === userId) return true;
    if (viewedIds.has(dump.id) && dump.expiry === "once") return false;
    return profilesById.get(dump.user_id)?.is_private === false;
  });

  if (!publicDumps.length) {
    return {
      candidates: [],
      interests: profileResult.data?.interests || [],
      followingIds: new Set(Object.entries(following)
        .filter(([, status]) => status === "accepted")
        .map(([id]) => id)),
    };
  }

  const hydratedTracks = await hydrateMusicTracks(
    publicDumps.map((dump) => dump.music_tracks).filter(Boolean),
  );
  const trackById = new Map(hydratedTracks.map((track) => [track.id, track]));

  const candidates = publicDumps.map((dump) => {
    const profile = profilesById.get(dump.user_id);
    const items = normalizeItems(dump.dump_items);

    return {
      id: dump.id,
      authorId: dump.user_id,
      author: profile?.username || "unknown",
      authorName: profile?.display_name || profile?.username || "unknown",
      avatarUrl: profile?.avatar_url || "",
      interests: profile?.interests || [],
      createdAt: dump.created_at,
      spaceId: dump.space_id || "",
      type: dump.type || "dump",
      mood: dump.mood || "",
      context: dump.context || "",
      frameCount: dump.frame_count || items.length || 1,
      mode: dump.expiry || "24h",
      viewed: viewedIds.has(dump.id),
      allowOthersToKeep: Boolean(dump.allow_others_to_keep),
      location: dump.location_name
        ? { name: dump.location_name, city: dump.location_city || "" }
        : null,
      items,
      musicTrack: dump.music_tracks
        ? trackById.get(dump.music_tracks.id) || dump.music_tracks
        : null,
      imagePath: items.find((item) => item.imagePath)?.imagePath || null,
    };
  });

  const interacted = await hydrateDumpInteractions(candidates);
  return {
    candidates: interacted,
    interests: profileResult.data?.interests || [],
    followingIds: new Set(Object.entries(following)
      .filter(([, status]) => status === "accepted")
      .map(([id]) => id)),
  };
}
