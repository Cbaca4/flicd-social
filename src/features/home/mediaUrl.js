import { supabase } from "../../lib/supabase";

export const LEGACY_MEDIA_BUCKET = "flicd-media";
export const PRIVATE_DUMP_MEDIA_BUCKET = "flicd-dump-private";
export const SIGNED_MEDIA_URL_SECONDS = 45;

// Only legacy media may use a public URL. Newly uploaded Dump media must
// remain in private storage; callers must not infer a public URL for it.
export function getDumpItemMediaUrl(imagePath, mediaBucket = LEGACY_MEDIA_BUCKET) {
  if (!imagePath || typeof imagePath !== "string") return null;
  if (mediaBucket === PRIVATE_DUMP_MEDIA_BUCKET) return null;
  if (mediaBucket !== LEGACY_MEDIA_BUCKET) return null;
  const bucket = import.meta.env.VITE_SUPABASE_MEDIA_BUCKET || LEGACY_MEDIA_BUCKET;
  const { data } = supabase.storage.from(bucket).getPublicUrl(imagePath);
  return data?.publicUrl || null;
}

export async function resolveDumpItemMediaUrl(item) {
  if (!item?.imagePath) return null;
  if (item.mediaBucket === PRIVATE_DUMP_MEDIA_BUCKET) {
    const { data, error } = await supabase.storage
      .from(PRIVATE_DUMP_MEDIA_BUCKET)
      .createSignedUrl(item.imagePath, SIGNED_MEDIA_URL_SECONDS);
    if (error) throw error;
    if (!data?.signedUrl) throw new Error("Private media is unavailable.");
    return data.signedUrl;
  }
  return getDumpItemMediaUrl(item.imagePath, item.mediaBucket);
}
