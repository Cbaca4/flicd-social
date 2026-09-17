import { describe, expect, it } from "vitest";

describe("comment feed mapping", () => {
  it("preserves multimedia fields when adding a saved comment to a post", async () => {
    const { appendSavedComment } = await import("./commentFeed.js");
    const post = {
      id: "dump-1",
      comments: [],
    };
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

    const result = appendSavedComment(post, savedComment, "baco");

    expect(result).toEqual({
      ...post,
      comments: [{
        id: "comment-1",
        from: "baco",
        text: null,
        media_type: "audio",
        media_url: null,
        media_path: "user-1/comments/audio-1.webm",
        media_metadata: { duration: 4.2 },
        created_at: "2026-09-17T01:00:00Z",
      }],
    });
  });
});
