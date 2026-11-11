import { supabase as authClient, createAccountClient } from "../../lib/supabase";
import { captureAuthScope } from "../../app/authScope.js";
import { MEDIA_BUCKET } from "../capture/mediaUpload.js";
import { isMediaGatewayConfigured, mediaApi } from "../home/mediaSessionApi.js";

export const ARCHIVE_BUCKET = "flicd-archive";
const SIGNED_URL_SECONDS = 60 * 60;

async function getUserId() {
  const { data, error } = await authClient.auth.getUser();
  if (error) throw error;
  if (!data?.user?.id) throw new Error("You must be logged in.");
  return data.user.id;
}

function extensionFor(path, mimeType = "") {
  const fromMime = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
  };
  return fromMime[mimeType] || String(path || "").split("?")[0].split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
}

async function archiveDumpMediaForUser(dumpId, userId, authScope) {
  const scope = captureAuthScope(authScope), supabase = createAccountClient(scope);
  scope.assertUser(userId);
  const { data: items, error: itemsError } = await supabase
    .from("dump_items")
    .select("id,position,image_path,media_bucket")
    .eq("dump_id", dumpId)
    .order("position", { ascending: true });
  if (itemsError) throw itemsError;
  scope.assertCurrent();

  const { data: existingRows, error: existingError } = await supabase
    .from("flicd_archive_items")
    .select("item_position,archive_path")
    .eq("user_id", userId)
    .eq("dump_id", dumpId);
  if (existingError) throw existingError;
  scope.assertCurrent();

  const existingPositions = new Set((existingRows || []).map((row) => Number(row.item_position)));
  for (const item of items || []) {
    if (!item.image_path || existingPositions.has(Number(item.position))) continue;
    scope.assertCurrent();

    const { data: file, error: downloadError } = await supabase.storage
      .from(item.media_bucket || MEDIA_BUCKET)
      .download(item.image_path);
    if (downloadError) throw downloadError;
    scope.assertCurrent();
    if (!file) throw new Error("Could not read archived media.");

    const path = userId + "/" + dumpId + "/" + item.position + "." + extensionFor(item.image_path, file.type);
    const { data: uploaded, error: uploadError } = await supabase.storage
      .from(ARCHIVE_BUCKET)
      .upload(path, file, {
        cacheControl: "31536000",
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });
    if (uploadError) throw uploadError;
    scope.assertCurrent();

    const { error: rowError } = await supabase.from("flicd_archive_items").upsert({
      user_id: userId,
      dump_id: dumpId,
      item_position: item.position,
      archive_path: uploaded?.path || path,
    }, { onConflict: "user_id,dump_id,item_position" });
    if (rowError) throw rowError;
    scope.assertCurrent();
  }

  const pathsByBucket = new Map();
  for (const item of items || []) {
    if (!item.image_path) continue;
    const bucket = item.media_bucket || MEDIA_BUCKET;
    pathsByBucket.set(bucket, [...(pathsByBucket.get(bucket) || []), item.image_path]);
  }
  for (const [bucket, paths] of pathsByBucket) {
    scope.assertCurrent();
    const { error: removeError } = await supabase.storage
      .from(bucket)
      .remove(Array.from(new Set(paths)));
    if (removeError) console.error("Failed to remove archived media:", removeError);
  }
}

export async function syncExpiredArchive(authScope) {
  const scope = captureAuthScope(authScope), supabase = createAccountClient(scope);
  // Feed expiry does not retire managed source bytes. Owner management and
  // authorized Keeps use trusted delivery without per-Board browser copies.
  if (isMediaGatewayConfigured()) return [];
  const userId = await getUserId();
  scope.assertUser(userId);
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: expired, error: expiredError } = await supabase
    .from("dumps")
    .select("id")
    .eq("user_id", userId)
    .eq("expiry", "24h")
    .lte("created_at", cutoff);
  if (expiredError) throw expiredError;
  scope.assertCurrent();

  const dumpReasons = new Map();
  (expired || []).forEach((row) => dumpReasons.set(row.id, "24h_expired"));
  const dumpIds = Array.from(dumpReasons.keys());
  if (!dumpIds.length) return [];

  const rows = dumpIds.map((dumpId) => ({
    user_id: userId,
    dump_id: dumpId,
    reason: dumpReasons.get(dumpId),
  }));
  const { data: archiveRows, error: archiveError } = await supabase
    .from("flicd_archive")
    .upsert(rows, { onConflict: "user_id,dump_id" })
    .select("dump_id,reason,archived_at");
  if (archiveError) throw archiveError;
  scope.assertCurrent();

  for (const dumpId of dumpIds) {
    try {
      scope.assertCurrent();
      await archiveDumpMediaForUser(dumpId, userId, scope);
    } catch (error) {
      if (!scope.isCurrent()) throw error;
      console.error("Failed to archive media for dump:", dumpId, error);
    }
  }
  return archiveRows || [];
}

export async function archiveDump(dumpId, reason = "24h_expired", authScope) {
  const scope = captureAuthScope(authScope), supabase = createAccountClient(scope);
  const userId = await getUserId();
  scope.assertUser(userId);
  const cleanReason = reason === "view_once" ? "view_once" : "24h_expired";

  const { data: ownedDump, error: dumpError } = await supabase
    .from("dumps")
    .select("id")
    .eq("id", dumpId)
    .eq("user_id", userId)
    .maybeSingle();
  if (dumpError) throw dumpError;
  if (!ownedDump) throw new Error("That post is not yours.");

  scope.assertCurrent();
  await archiveDumpMediaForUser(dumpId, userId, scope);
  scope.assertCurrent();

  const { data, error } = await supabase
    .from("flicd_archive")
    .upsert({ user_id: userId, dump_id: dumpId, reason: cleanReason }, { onConflict: "user_id,dump_id" })
    .select("dump_id,reason,archived_at")
    .single();
  if (error) throw error;
  return data;
}

export async function getArchiveDumps(authScope) {
  const scope = captureAuthScope(authScope), supabase = createAccountClient(scope);
  if (isMediaGatewayConfigured()) {
    const rows = await mediaApi.json("owner/archive", {}, { authScope: scope });
    scope.assertCurrent();
    return Promise.all(rows.map(async (dump) => ({
      ...dump,
      dump_items: await Promise.all(dump.dump_items.map(async (item) => {
        try {
          const file = await mediaApi.blob("owner/frame", { itemId: item.id }, { authScope: scope });
          scope.assertCurrent();
          return { ...item, archiveUrl: URL.createObjectURL(file) };
        } catch { return { ...item, archiveUrl: null }; }
      })),
    })));
  }
  const userId = await getUserId();
  scope.assertUser(userId);
  await syncExpiredArchive(scope);
  scope.assertCurrent();

  const { data: archiveRows, error: archiveError } = await supabase
    .from("flicd_archive")
    .select("dump_id,reason,archived_at")
    .eq("user_id", userId)
    .order("archived_at", { ascending: false });
  if (archiveError) throw archiveError;
  const dumpIds = (archiveRows || []).map((row) => row.dump_id).filter(Boolean);
  if (!dumpIds.length) return [];

  const [{ data: dumps, error: dumpError }, { data: mediaRows, error: mediaError }] = await Promise.all([
    supabase.from("dumps").select("id,user_id,type,mood,expiry,context,created_at,dump_items(id,position,note,image_path,media_bucket)").eq("user_id", userId).in("id", dumpIds),
    supabase.from("flicd_archive_items").select("dump_id,item_position,archive_path").eq("user_id", userId).in("dump_id", dumpIds),
  ]);
  if (dumpError) throw dumpError;
  if (mediaError) throw mediaError;

  const mediaByKey = new Map();
  await Promise.all((mediaRows || []).map(async (row) => {
    const { data: signed, error } = await supabase.storage
      .from(ARCHIVE_BUCKET)
      .createSignedUrl(row.archive_path, SIGNED_URL_SECONDS);
    if (!error && signed?.signedUrl) mediaByKey.set(row.dump_id + ":" + row.item_position, signed.signedUrl);
  }));

  const archiveByDumpId = new Map((archiveRows || []).map((row) => [row.dump_id, row]));
  return (dumps || []).map((dump) => ({
    ...dump,
    archive: archiveByDumpId.get(dump.id) || null,
    dump_items: (dump.dump_items || []).sort((a, b) => a.position - b.position).map((item) => ({
      ...item,
      archiveUrl: mediaByKey.get(dump.id + ":" + item.position) || null,
    })),
  })).sort((a, b) => new Date(b.archive?.archived_at || b.created_at).getTime() - new Date(a.archive?.archived_at || a.created_at).getTime());
}

export function releaseArchiveMedia(dumps) {
  for (const dump of dumps || []) for (const item of dump.dump_items || []) {
    if (item.archiveUrl?.startsWith("blob:")) URL.revokeObjectURL?.(item.archiveUrl);
  }
}