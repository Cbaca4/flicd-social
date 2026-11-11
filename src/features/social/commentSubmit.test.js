import { beforeEach, describe, expect, it, vi } from "vitest";
import { testAuthScope } from '../../../tests/security/testAuthScope.js';

const addComment = vi.hoisted(() => vi.fn());
const sendCommentMedia = vi.hoisted(() => vi.fn());

vi.mock("./interactionsApi.js", () => ({ addComment }));
vi.mock("./commentMediaApi.js", () => ({ sendCommentMedia }));

describe("comment submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addComment.mockResolvedValue({ id: "text-1", text: "hello", media_type: "text" });
    sendCommentMedia.mockResolvedValue({ id: "audio-1", text: null, media_type: "audio" });
  });

  it("routes audio media through the comment media uploader", async () => {
    const { submitComment } = await import("./commentSubmit.js");
    const blob = new Blob(["voice"], { type: "audio/webm" });

    const result = await submitComment("dump-1", {
      media_type: "audio",
      media_blob: blob,
    }, testAuthScope('user-1'));

    expect(sendCommentMedia).toHaveBeenCalledWith("dump-1", {
      mediaType: "audio",
      mediaBlob: blob,
      authScope: expect.objectContaining({ user: 'user-1' }),
    });
    expect(addComment).not.toHaveBeenCalled();
    expect(result).toEqual({ id: "audio-1", text: null, media_type: "audio" });
  });

  it("routes video media through the uploader with duration metadata", async () => {
    const { submitComment } = await import("./commentSubmit.js");
    const blob = new File(["video"], "clip.mp4", { type: "video/mp4" });
    const savedVideo = {
      id: "video-1",
      text: null,
      media_type: "video",
      media_path: "user-1/comments/video-1.mp4",
      media_metadata: { duration_seconds: 12 },
    };
    sendCommentMedia.mockResolvedValueOnce(savedVideo);

    const result = await submitComment("dump-1", {
      media_type: "video",
      media_blob: blob,
      media_metadata: { duration_seconds: 12 },
    }, testAuthScope('user-1'));

    expect(sendCommentMedia).toHaveBeenCalledWith("dump-1", {
      mediaType: "video",
      mediaBlob: blob,
      mediaMetadata: { duration_seconds: 12 },
      authScope: expect.objectContaining({ user: 'user-1' }),
    });
    expect(addComment).not.toHaveBeenCalled();
    expect(result).toEqual(savedVideo);
  });

  it("keeps text comments on the existing text comment API", async () => {
    const { submitComment } = await import("./commentSubmit.js");

    await submitComment("dump-1", "  hello  ", testAuthScope('user-1'));

    expect(addComment).toHaveBeenCalledWith("dump-1", "hello", expect.objectContaining({ user: 'user-1' }));
    expect(sendCommentMedia).not.toHaveBeenCalled();
  });
});
