import { supabase } from "../../lib/supabase";

export async function syncExpiredArchive() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData?.user?.id;
  if (!userId) return [];

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [expiredResult, viewedResult] = await Promise.all([
    supabase.from("dumps").select("id").eq("user_id", userId).eq("expiry", "24h").lte("created_at", cutoff),
    supabase.from("dump_views").select("dump_id").eq("user_id", userId),
  ]);
  if (expiredResult.error) throw expiredResult.error;
  if (viewedResult.error) throw viewedResult.error;

  const viewedIds = (viewedResult.data || []).map((row) => row.dump_id).filter(Boolean);
  let onceIds = [];
  if (viewedIds.length) {
    const { data, error } = await supabase.from("dumps").select("id").eq("user_id", userId).eq("expiry", "once").in("id", viewedIds);
    if (error) throw error;
    onceIds = (data || []).map((row) => row.id);
  }

  const archiveRows = [
    ...(expiredResult.data || []).map((row) => ({ user_id: userId, dump_id: row.id, reason: "24h_expired" })),
    ...onceIds.map((dumpId) => ({ user_id: userId, dump_id: dumpId, reason: "view_once" })),
  ];
  if (!archiveRows.length) return [];

  const { data, error } = await supabase.from("flicd_archive").upsert(archiveRows, { onConflict: "user_id,dump_id" }).select("dump_id,reason,archived_at");
  if (error) throw error;
  return data || [];
}

export async function archiveDump(dumpId, reason = "24h_expired") {
  if (!dumpId) return null;
  const cleanReason = reason === "view_once" ? "view_once" : "24h_expired";
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData?.user?.id;
  if (!userId) throw new Error("You must be logged in.");

  const { data, error } = await supabase.from("flicd_archive").upsert(
    { user_id: userId, dump_id: dumpId, reason: cleanReason },
    { onConflict: "user_id,dump_id" },
  ).select("dump_id,reason,archived_at").single();
  if (error) throw error;
  return data;
}

export async function getArchiveDumps() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData?.user?.id;
  if (!userId) return [];

  await syncExpiredArchive();

  const { data: archiveRows, error: archiveError } = await supabase.from("flicd_archive").select("dump_id,reason,archived_at").eq("user_id", userId).order("archived_at", { ascending: false });
  if (archiveError) throw archiveError;
  const dumpIds = (archiveRows || []).map((row) => row.dump_id).filter(Boolean);
  if (!dumpIds.length) return [];

  const { data: dumps, error: dumpError } = await supabase.from("dumps").select(`
    id, user_id, type, mood, expiry, context, created_at,
    dump_items ( id, position, note, image_path )
  `).eq("user_id", userId).in("id", dumpIds);
  if (dumpError) throw dumpError;

  const archiveByDumpId = new Map((archiveRows || []).map((row) => [row.dump_id, row]));
  return (dumps || []).map((dump) => ({
    ...dump,
    archive: archiveByDumpId.get(dump.id) || null,
    dump_items: (dump.dump_items || []).sort((a, b) => a.position - b.position),
  })).sort((a, b) => new Date(b.archive?.archived_at || b.created_at).getTime() - new Date(a.archive?.archived_at || a.created_at).getTime());
}