import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.hoisted(() => vi.fn());
const upload = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: { getUser },
    storage: { from },
  },
}));

describe("comment media upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    from.mockReturnValue({ upload });
    upload.mockResolvedValue({ data: { path: "user-1/comments/media-1.webm" }, error: null });
  });

  it("accepts a supported voice recording and uploads it under the current user's comment folder", async () => {
    const { uploadCommentMedia } = await import("./commentMediaUpload.js");
    const file = new File(["voice"], "voice.webm", { type: "audio/webm" });

    const path = await uploadCommentMedia(file, {
      mediaType: "audio",
      createId: () => "media-1",
    });

    expect(path).toBe("user-1/comments/media-1.webm");
    expect(from).toHaveBeenCalledWith("flicd-media");
    expect(upload).toHaveBeenCalledWith("user-1/comments/media-1.webm", file, {
      cacheControl: "31536000",
      contentType: "audio/webm",
      upsert: false,
    });
  });

  it("accepts supported video media and uses a video extension", async () => {
    const { uploadCommentMedia } = await import("./commentMediaUpload.js");
    const file = new File(["video"], "clip.mp4", { type: "video/mp4" });

    await uploadCommentMedia(file, {
      mediaType: "video",
      createId: () => "media-2",
    });

    expect(upload).toHaveBeenCalledWith(
      "user-1/comments/media-2.mp4",
      file,
      expect.objectContaining({ contentType: "video/mp4" }),
    );
  });

  it("rejects an unsupported comment media type before uploading", async () => {
    const { uploadCommentMedia } = await import("./commentMediaUpload.js");
    const file = new File(["file"], "file.txt", { type: "text/plain" });

    await expect(uploadCommentMedia(file, {
      mediaType: "audio",
      createId: () => "media-3",
    })).rejects.toThrow("Only supported audio and video files can be attached to comments.");

    expect(upload).not.toHaveBeenCalled();
  });

  it("allows a video at exactly 15 seconds", async () => {
    const { validateCommentVideoDuration } = await import("./commentMediaUpload.js");

    expect(() => validateCommentVideoDuration(15)).not.toThrow();
  });

  it("rejects a video longer than 15 seconds", async () => {
    const { validateCommentVideoDuration } = await import("./commentMediaUpload.js");

    expect(() => validateCommentVideoDuration(15.01)).toThrow("Comment videos must be 15 seconds or shorter.");
  });
});
