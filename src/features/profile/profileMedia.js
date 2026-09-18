import { supabase } from "../../lib/supabase";
import { createMediaId, MEDIA_BUCKET } from "../capture/mediaUpload.js";

export const MAX_PROFILE_PHOTO_SIZE = 5 * 1024 * 1024;
export const MAX_PROFILE_BACKGROUND_IMAGE_SIZE = 12 * 1024 * 1024;
export const MAX_PROFILE_BACKGROUND_VIDEO_SIZE = 30 * 1024 * 1024;
export const MAX_PROFILE_BACKGROUND_OUTPUT_SIZE = 3 * 1024 * 1024;
export const PROFILE_BACKGROUND_MAX_DIMENSION = 1920;
export const PROFILE_BACKGROUND_VIDEO_MAX_SECONDS = 10;
export const PROFILE_BACKGROUND_VIDEO_MAX_WIDTH = 1920;
export const PROFILE_BACKGROUND_VIDEO_MAX_HEIGHT = 1080;
export const ALLOWED_PROFILE_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const ALLOWED_PROFILE_BACKGROUND_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

function extensionForType(type) {
  const extensions = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
  };
  return extensions[type] || null;
}

function validateBackgroundFile(file) {
  if (!file) throw new Error("Please choose a background photo or video.");
  if (!ALLOWED_PROFILE_BACKGROUND_TYPES.includes(file.type)) {
    throw new Error("Backgrounds support JPEG, PNG, WebP, MP4, WebM, or MOV.");
  }

  const limit = file.type.startsWith("video/")
    ? MAX_PROFILE_BACKGROUND_VIDEO_SIZE
    : MAX_PROFILE_BACKGROUND_IMAGE_SIZE;

  if (file.size > limit) {
    throw new Error(
      file.type.startsWith("video/")
        ? "Profile background videos must be 30 MB or smaller."
        : "Profile background photos must be 12 MB or smaller.",
    );
  }

  return file;
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

function readImageDimensions(file) {
  if (
    typeof Image === "undefined" ||
    typeof URL?.createObjectURL !== "function"
  ) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: Number(image.naturalWidth || image.width) || 0,
        height: Number(image.naturalHeight || image.height) || 0,
      });
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that background photo."));
    };

    image.src = url;
  });
}

function readVideoMetadata(file) {
  if (
    typeof document === "undefined" ||
    typeof URL?.createObjectURL !== "function"
  ) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve({
        duration: Number(video.duration) || 0,
        width: Number(video.videoWidth) || 0,
        height: Number(video.videoHeight) || 0,
      });
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that background video."));
    };

    video.src = url;
  });
}

export async function validateProfileBackgroundVideo(file) {
  const selected = validateBackgroundFile(file);
  if (!selected.type.startsWith("video/")) return null;

  const metadata = await readVideoMetadata(selected);
  if (!metadata) return null;

  if (
    !Number.isFinite(metadata.duration) ||
    metadata.duration <= 0 ||
    metadata.duration > PROFILE_BACKGROUND_VIDEO_MAX_SECONDS
  ) {
    throw new Error("Background videos and Live Photos must be 10 seconds or shorter.");
  }

  if (
    metadata.width > PROFILE_BACKGROUND_VIDEO_MAX_WIDTH ||
    metadata.height > PROFILE_BACKGROUND_VIDEO_MAX_HEIGHT
  ) {
    throw new Error("Background videos should be 1920×1080 or smaller.");
  }

  return metadata;
}

async function optimizeProfileBackgroundImage(file) {
  const dimensions = await readImageDimensions(file);

  if (
    !dimensions ||
    (!dimensions.width && !dimensions.height)
  ) {
    return file;
  }

  const maxDimension = Math.max(dimensions.width, dimensions.height);
  const needsResize = maxDimension > PROFILE_BACKGROUND_MAX_DIMENSION;
  const needsCompression = file.size > MAX_PROFILE_BACKGROUND_OUTPUT_SIZE;

  if (!needsResize && !needsCompression) {
    return file;
  }

  if (
    typeof document === "undefined" ||
    typeof document.createElement !== "function" ||
    typeof URL?.createObjectURL !== "function" ||
    typeof File === "undefined"
  ) {
    return file;
  }

  const scale = Math.min(
    1,
    PROFILE_BACKGROUND_MAX_DIMENSION / Math.max(dimensions.width, dimensions.height),
  );
  const width = Math.max(1, Math.round(dimensions.width * scale));
  const height = Math.max(1, Math.round(dimensions.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    return file;
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  const sourceUrl = URL.createObjectURL(file);
  const image = new Image();

  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("Could not prepare that background photo."));
      image.src = sourceUrl;
    });

    context.drawImage(image, 0, 0, width, height);
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }

  const qualities = [0.84, 0.78, 0.72, 0.66];
  let bestBlob = null;

  for (const quality of qualities) {
    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/webp", quality);
    });

    if (!blob) continue;
    bestBlob = blob;

    if (blob.size <= MAX_PROFILE_BACKGROUND_OUTPUT_SIZE) {
      break;
    }
  }

  if (!bestBlob) {
    throw new Error("Could not prepare that background photo.");
  }

  if (bestBlob.size > MAX_PROFILE_BACKGROUND_OUTPUT_SIZE) {
    throw new Error(
      "That background is still too large after optimization. Try a slightly smaller photo.",
    );
  }

  const baseName = String(file.name || "profile-background").replace(/\.[^.]+$/, "") || "profile-background";
  return new File([bestBlob], baseName + ".webp", {
    type: "image/webp",
    lastModified: file.lastModified || Date.now(),
  });
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

export async function uploadProfileBackground(file) {
  const selected = validateBackgroundFile(file);

  if (selected.type.startsWith("video/")) {
    await validateProfileBackgroundVideo(selected);
  }

  const optimized =
    selected.type.startsWith("image/")
      ? await optimizeProfileBackgroundImage(selected)
      : selected;

  const userId = await getCurrentUserId();
  const extension = extensionForType(optimized.type);
  const path = userId + "/profile/background/" + createMediaId() + "." + extension;

  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, optimized, {
      cacheControl: "31536000",
      contentType: optimized.type,
      upsert: false,
    });

  if (error) throw error;

  const { data: publicData } = supabase.storage
    .from(MEDIA_BUCKET)
    .getPublicUrl(data.path);

  const publicUrl = publicData?.publicUrl;
  if (!publicUrl) {
    await removeProfilePhoto(data.path);
    throw new Error("Background uploaded, but its public URL could not be created.");
  }

  return {
    url: publicUrl,
    type: optimized.type.startsWith("video/") ? "video" : "image",
    mimeType: optimized.type,
    path: data.path,
    optimized: optimized !== selected,
  };
}
