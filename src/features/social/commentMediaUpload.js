import { supabase } from "../../lib/supabase";

export const COMMENT_MEDIA_BUCKET = "flicd-media";
export const MAX_COMMENT_VIDEO_DURATION = 15;

const COMMENT_MEDIA_TYPES = {
  audio: {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mp4": "m4a",
  },
  video: {
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
  },
};

function getExtension(mediaType, mimeType) {
  return COMMENT_MEDIA_TYPES[mediaType]?.[mimeType] || null;
}

async function getCurrentUserId() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("You must be logged in to upload comment media.");
  return user.id;
}

export function validateCommentMediaFile(file, mediaType) {
  const extension = getExtension(mediaType, file?.type);
  if (!extension) {
    throw new Error("Only supported audio and video files can be attached to comments.");
  }
  return extension;
}

export function validateCommentVideoDuration(duration) {
  if (!Number.isFinite(duration) || duration < 0) {
    throw new Error("Unable to determine video duration.");
  }
  if (duration > MAX_COMMENT_VIDEO_DURATION) {
    throw new Error("Comment videos must be 15 seconds or shorter.");
  }
  return duration;
}

export async function uploadCommentMedia(file, { mediaType, createId = () => crypto.randomUUID() } = {}) {
  const extension = validateCommentMediaFile(file, mediaType);
  const userId = await getCurrentUserId();
  const path = `${userId}/comments/${createId()}.${extension}`;
  const { data, error } = await supabase.storage.from(COMMENT_MEDIA_BUCKET).upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return data.path;
}
