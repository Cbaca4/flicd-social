import { supabase } from "../../lib/supabase";
import { uploadCommentMedia } from "./commentMediaUpload.js";
import { addComment } from "./interactionsApi.js";

export async function sendCommentMedia(dumpId, { mediaType, mediaBlob, mediaMetadata = null } = {}) {
  if (!dumpId) throw new Error("A dump is required for a comment.");
  if (!(mediaBlob instanceof Blob)) throw new Error("Comment media is required.");
  if (!["audio", "video"].includes(mediaType)) {
    throw new Error("Only audio and video comments can be uploaded.");
  }

  const mediaPath = await uploadCommentMedia(mediaBlob, { mediaType });

  try {
    return await addComment(dumpId, {
      text: null,
      media_type: mediaType,
      media_url: null,
      media_path: mediaPath,
      media_metadata: mediaMetadata,
    });
  } catch (error) {
    await supabase.storage.from("flicd-media").remove([mediaPath]).catch(() => {});
    throw error;
  }
}
