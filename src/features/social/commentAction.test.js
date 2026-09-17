import { beforeEach, describe, expect, it, vi } from "vitest";

const submitComment = vi.hoisted(() => vi.fn());

vi.mock("./commentSubmit.js", () => ({ submitComment }));

describe("comment action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits a voice comment and appends the saved multimedia comment to the matching post", async () => {
    const { createCommentAction } = await import("./commentAction.js");
    const savedComment = {
      id: "comment-1",
      user_id: "user-1",
      text: null,
      media_type: "audio",
      media_url: null,
      media_path: "user-1/comments/audio-1.webm",
      media_metadata: { duration: 4.2 },
      created_at: "2026-09-17T01:00:00Z",
    };
    submitComment.mockResolvedValue(savedComment);

    let posts = [{ id: "dump-1", comments: [] }, { id: "dump-2", comments: [] }];
    const setPosts = (updater) => {
      posts = updater(posts);
    };

    const action = createCommentAction({
      submitCommentFn: submitComment,
      setPosts,
      username: "baco",
    });

    const blob = new Blob(["voice"], { type: "audio/webm" });
    await action("dump-1", { media_type: "audio", media_blob: blob });

    expect(submitComment).toHaveBeenCalledWith("dump-1", { media_type: "audio", media_blob: blob });
    expect(posts[0].comments).toEqual([{
      id: "comment-1",
      from: "baco",
      text: null,
      media_type: "audio",
      media_url: null,
      media_path: "user-1/comments/audio-1.webm",
      media_metadata: { duration: 4.2 },
      created_at: "2026-09-17T01:00:00Z",
    }]);
    expect(posts[1].comments).toEqual([]);
  });
});
