import { supabase } from "../../lib/supabase";
import { createMediaId, MEDIA_BUCKET } from "../capture/mediaUpload.js";

export const MAX_PROFILE_PHOTO_SIZE = 5 * 1024 * 1024;
export const ALLOWED_PROFILE_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

function extensionForType(type) {
  const extensions = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return extensions[type] || null;
}

export function validateProfilePhoto(file) {
  if (!file) throw new Error("Please choose a profile photo.");
  if (!ALLOWED_PROFILE_PHOTO_TYPES.includes(file.type)) {
    throw new Error("Only JPEG, PNG, and WebP profile photos are supported.");
  }
  if (file.size > MAX_PROFILE_PHOTO_SIZE) {
    throw new Error("Your profile photo must be 5 MB or smaller.");
  }
  return file;
}

async function getCurrentUserId() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("You must be logged in to upload a profile photo.");
  return user.id;
}

export async function uploadProfilePhoto(file) {
  const selected = validateProfilePhoto(file);
  const userId = await getCurrentUserId();
  const extension = extensionForType(selected.type);
  const path = `${userId}/profile/${createMediaId()}.${extension}`;

  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, selected, {
      cacheControl: "31536000",
      contentType: selected.type,
      upsert: false,
    });
  if (error) throw error;

  const { data: publicData } = supabase.storage
    .from(MEDIA_BUCKET)
    .getPublicUrl(data.path);
  const publicUrl = publicData?.publicUrl;
  if (!publicUrl) {
    await removeProfilePhoto(data.path);
    throw new Error("Profile photo uploaded, but its public URL could not be created.");
  }
  return publicUrl;
}

export async function removeProfilePhoto(pathOrUrl) {
  if (!pathOrUrl) return;
  const marker = `/storage/v1/object/public/${MEDIA_BUCKET}/`;
  const path = String(pathOrUrl).includes(marker)
    ? decodeURIComponent(String(pathOrUrl).split(marker)[1].split("?")[0])
    : String(pathOrUrl);
  if (!path) return;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).remove([path]);
  if (error) console.error("Failed to clean up profile photo:", error);
}
