import { supabase } from "../../lib/supabase";

const DEFAULT_MEDIA_BUCKET = "flicd-media";

export function getDumpItemMediaUrl(imagePath) {
  if (!imagePath || typeof imagePath !== "string") {
    return null;
  }

  const bucket = import.meta.env.VITE_SUPABASE_MEDIA_BUCKET || DEFAULT_MEDIA_BUCKET;
  const { data } = supabase.storage.from(bucket).getPublicUrl(imagePath);
  return data?.publicUrl || null;
}
