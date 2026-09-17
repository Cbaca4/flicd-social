import { supabase } from "../../lib/supabase";

const DEFAULT_MEDIA_BUCKET = "flicd-media";
const COMMENT_MEDIA_URL_TTL_SECONDS = 60 * 60;

export async function getCommentMediaUrl(comment = {}) {
  if (comment.media_url) {
    return comment.media_url;
  }

  if (!comment.media_path || typeof comment.media_path !== "string") {
    return null;
  }

  const bucket = import.meta.env.VITE_SUPABASE_MEDIA_BUCKET || DEFAULT_MEDIA_BUCKET;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(comment.media_path, COMMENT_MEDIA_URL_TTL_SECONDS);

  if (error) {
    throw error;
  }

  return data?.signedUrl || null;
}
