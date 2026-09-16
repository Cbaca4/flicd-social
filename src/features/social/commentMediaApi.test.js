import { beforeEach, describe, expect, it, vi } from "vitest";

const uploadCommentMedia = vi.hoisted(() => vi.fn());
const addComment = vi.hoisted(() => vi.fn());

vi.mock("./commentMediaUpload.js", () => ({ uploadCommentMedia }));
vi.mock("./interactionsApi.js", () => ({ addComment }));

describe("comment media API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadCommentMedia.mockResolvedValue("user-1/comments/audio-1.webm");
    addComment.mockResolvedValue({
      id: "comment-1",
      dump_id: "dump-1",
      user_id: "user-1",
      text: null,
      media_type: "audio",
      media_url: null,
      media_path: "user-1/comments/audio-1.webm",
      media_metadata: null,
      created_at: "2026-09-16T23:00:00Z",
    });
  });

  it("uploads an audio blob before saving the audio comment path", async () => {
    const { sendCommentMedia } = await import("./commentMediaApi.js");
    const blob = new Blob(["voice"], { type: "audio/webm" });

    await sendCommentMedia("dump-1", {
      mediaType: "audio",
      mediaBlob: blob,
    });

    expect(uploadCommentMedia).toHaveBeenCalledWith(blob, { mediaType: "audio" });
    expect(addComment).toHaveBeenCalledWith("dump-1", {
      text: null,
      media_type: "audio",
      media_url: null,
      media_path: "user-1/comments/audio-1.webm",
      media_metadata: null,
    });
  });
});
