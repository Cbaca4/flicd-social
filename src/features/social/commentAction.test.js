import { describe, expect, it, vi } from "vitest";

describe("comment action", () => {
  it("submits a voice comment and appends the saved multimedia comment to the matching post", async () => {
    const { createCommentAction } = await import("./commentAction.js");
    const submitComment = vi.fn().mockResolvedValue({
      id: "comment-1",
      user_id: "user-1",
      text: null,
      media_type: "audio",
      media_url: null,
      media_path: "user-1/comments/audio-1.webm",
      media_metadata: null,
      created_at: "2026-09-17T02:10:00Z",
    });
    const setDumps = vi.fn((updater) => updater([
      { id: "dump-1", comments: [] },
      { id: "dump-2", comments: [] },
    ]));
    const onToast = vi.fn();

    const comment = createCommentAction({
      submitComment,
      setDumps,
      username: "baco",
      onToast,
    });

    await comment("dump-1", {
      media_type: "audio",
      media_blob: new Blob(["voice"], { type: "audio/webm" }),
    });

    expect(submitComment).toHaveBeenCalledTimes(1);
    expect(submitComment).toHaveBeenCalledWith("dump-1", expect.objectContaining({ media_type: "audio" }));
    expect(setDumps).toHaveBeenCalledTimes(1);
    expect(onToast).not.toHaveBeenCalled();
  });
});
