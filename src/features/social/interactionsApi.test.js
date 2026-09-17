import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());

vi.mock("../../lib/supabase", () => ({
  supabase: { auth: { getUser }, from },
}));

function chain(result) {
  const api = {
    select: vi.fn(() => api),
    eq: vi.fn(() => api),
    in: vi.fn(() => api),
    order: vi.fn(() => api),
    insert: vi.fn(() => api),
    delete: vi.fn(() => api),
    upsert: vi.fn(() => api),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return api;
}

describe("social interactions API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "me" } }, error: null });
  });

  it("adds a like without requiring an update permission", async () => {
    const addLike = chain({ data: { dump_id: "dump-1", user_id: "me" }, error: null });
    from.mockReturnValue(addLike);

    const { likeDump } = await import("./interactionsApi.js");
    await likeDump("dump-1");

    expect(addLike.upsert).toHaveBeenCalledWith(
      { dump_id: "dump-1", user_id: "me" },
      { onConflict: "dump_id,user_id", ignoreDuplicates: true },
    );
  });

  it("removes a like for the current user", async () => {
    const removeLike = chain({ data: null, error: null });
    from.mockReturnValue(removeLike);

    const { unlikeDump } = await import("./interactionsApi.js");
    await unlikeDump("dump-1");

    expect(removeLike.delete).toHaveBeenCalled();
    expect(removeLike.eq).toHaveBeenCalledWith("dump_id", "dump-1");
    expect(removeLike.eq).toHaveBeenCalledWith("user_id", "me");
  });

  it("creates a trimmed comment for the current user", async () => {
    const query = chain({ data: { id: "comment-1", text: "hello" }, error: null });
    from.mockReturnValue(query);

    const { addComment } = await import("./interactionsApi.js");
    const comment = await addComment("dump-1", "  hello  ");

    expect(comment.text).toBe("hello");
    expect(query.insert).toHaveBeenCalledWith({
      dump_id: "dump-1",
      user_id: "me",
      text: "hello",
      media_type: "text",
      media_url: null,
      media_path: null,
      media_metadata: null,
    });
  });

  it("creates a GIF comment with media metadata", async () => {
    const query = chain({
      data: {
        id: "comment-gif",
        dump_id: "dump-1",
        user_id: "me",
        text: null,
        media_type: "gif",
        media_url: "https://media.giphy.com/media/abc/giphy.gif",
        media_path: null,
        media_metadata: { provider: "giphy", id: "abc" },
      },
      error: null,
    });
    from.mockReturnValue(query);

    await import("./interactionsApi.js").then(({ addComment }) => addComment("dump-1", {
      text: "",
      media_type: "gif",
      media_url: "https://media.giphy.com/media/abc/giphy.gif",
      media_path: null,
      media_metadata: { provider: "giphy", id: "abc" },
    }));

    expect(query.insert).toHaveBeenCalledWith({
      dump_id: "dump-1",
      user_id: "me",
      text: null,
      media_type: "gif",
      media_url: "https://media.giphy.com/media/abc/giphy.gif",
      media_path: null,
      media_metadata: { provider: "giphy", id: "abc" },
    });
  });

  it("rejects empty comments", async () => {
    const { addComment } = await import("./interactionsApi.js");

    await expect(addComment("dump-1", "   ")).rejects.toThrow("Comment cannot be empty");
  });

  it("rejects comments over the maximum length", async () => {
    const { addComment } = await import("./interactionsApi.js");

    await expect(addComment("dump-1", "x".repeat(501))).rejects.toThrow("500 characters or fewer");
  });

  it("deletes a comment for the current user", async () => {
    const query = chain({ data: null, error: null });
    from.mockReturnValue(query);

    const { deleteComment } = await import("./interactionsApi.js");
    await deleteComment("comment-1");

    expect(query.delete).toHaveBeenCalled();
    expect(query.eq).toHaveBeenCalledWith("id", "comment-1");
    expect(query.eq).toHaveBeenCalledWith("user_id", "me");
  });

  it("reports a comment for the current user with a reason", async () => {
    const query = chain({ data: { id: "report-1" }, error: null });
    from.mockReturnValue(query);

    const { reportComment } = await import("./interactionsApi.js");
    await reportComment("comment-2", "spam");

    expect(query.insert).toHaveBeenCalledWith({
      comment_id: "comment-2",
      reporter_id: "me",
      reason: "spam",
    });
  });

  it("hydrates feed interaction counts and current-user state with usernames", async () => {
    const likes = chain({
      data: [
        { dump_id: "dump-1", user_id: "me" },
        { dump_id: "dump-1", user_id: "friend" },
        { dump_id: "dump-2", user_id: "friend" },
      ],
      error: null,
    });
    const comments = chain({
      data: [
        {
          id: "c1",
          dump_id: "dump-1",
          user_id: "friend",
          text: "hi",
          media_type: "text",
          media_url: null,
          media_path: null,
          media_metadata: null,
          created_at: "2026-09-16T10:00:00Z",
        },
      ],
      error: null,
    });
    const profiles = chain({
      data: [{ id: "friend", username: "friend_1", display_name: "Friend" }],
      error: null,
    });
    from.mockImplementationOnce(() => likes).mockImplementationOnce(() => comments).mockImplementationOnce(() => profiles);

    const { hydrateDumpInteractions } = await import("./interactionsApi.js");
    const result = await hydrateDumpInteractions([
      { id: "dump-1" },
      { id: "dump-2" },
    ]);

    expect(result).toEqual([
      {
        id: "dump-1",
        likes: 2,
        liked: true,
        comments: [{
          id: "c1",
          from: "friend_1",
          displayName: "Friend",
          text: "hi",
          media_type: "text",
          media_url: null,
          media_path: null,
          media_metadata: null,
          created_at: "2026-09-16T10:00:00Z",
        }],
      },
      { id: "dump-2", likes: 1, liked: false, comments: [] },
    ]);
  });
});
