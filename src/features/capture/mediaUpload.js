import { supabase } from "../../lib/supabase";

export const MEDIA_BUCKET = "flicd-media";
export const MAX_MEDIA_SIZE = 10 * 1024 * 1024;
export const MAX_MEDIA_COUNT = 20;
export const ALLOWED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"];

function extensionForType(type) {
  const extensions = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return extensions[type] || null;
}

export function createMediaId(cryptoSource = globalThis.crypto) {
  const randomUUID = cryptoSource?.randomUUID;
  if (typeof randomUUID === "function") return randomUUID.call(cryptoSource);
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function validateMediaFile(file) {
  if (!file) throw new Error("Please choose an image.");
  if (!ALLOWED_MEDIA_TYPES.includes(file.type)) {
    throw new Error("Only JPEG, PNG, and WebP images are supported.");
  }
  if (file.size > MAX_MEDIA_SIZE) {
    throw new Error("Each image must be 10 MB or smaller.");
  }
  return file;
}

export function validateMediaFiles(files) {
  const selected = Array.from(files || []);
  if (!selected.length) throw new Error("Please choose at least one image.");
  if (selected.length > MAX_MEDIA_COUNT) {
    throw new Error(`You can add up to ${MAX_MEDIA_COUNT} images.`);
  }
  selected.forEach(validateMediaFile);
  return selected;
}

async function getCurrentUserId() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("You must be logged in to upload media.");
  return user.id;
}

export async function uploadDumpImages(files) {
  const selected = validateMediaFiles(files);
  const userId = await getCurrentUserId();
  const uploadedPaths = [];

  try {
    for (const file of selected) {
      const extension = extensionForType(file.type);
      const path = `${userId}/${createMediaId()}.${extension}`;
      const { data, error } = await supabase.storage
        .from(MEDIA_BUCKET)
        .upload(path, file, {
          cacheControl: "31536000",
          contentType: file.type,
          upsert: false,
        });
      if (error) throw error;
      uploadedPaths.push(data.path);
    }
    return uploadedPaths;
  } catch (error) {
    if (uploadedPaths.length) await removeDumpImages(uploadedPaths);
    throw error;
  }
}

export async function removeDumpImages(paths) {
  const cleanPaths = Array.from(new Set((paths || []).filter(Boolean)));
  if (!cleanPaths.length) return;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).remove(cleanPaths);
  if (error) console.error("Failed to clean up uploaded media:", error);
}
