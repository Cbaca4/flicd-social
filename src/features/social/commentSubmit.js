import { sendCommentMedia } from "./commentMediaApi.js";
import { addComment } from "./interactionsApi.js";

export async function submitComment(dumpId, input) {
  if (input && typeof input === "object" && input.media_type) {
    if (!["audio", "video", "gif"].includes(input.media_type)) {
      throw new Error("Unsupported comment media type");
    }

    if (input.media_type === "audio" || input.media_type === "video") {
      return sendCommentMedia(dumpId, {
        mediaType: input.media_type,
        mediaBlob: input.media_blob,
        mediaMetadata: input.media_metadata ?? null,
      });
    }

    return addComment(dumpId, {
      text: input.text ?? "",
      media_type: "gif",
      media_url: input.media_url ?? null,
      media_path: null,
      media_metadata: input.media_metadata ?? null,
    });
  }

  const cleanText = String(input ?? "").trim();
  if (!cleanText) throw new Error("Comment cannot be empty");
  return addComment(dumpId, cleanText);
}
