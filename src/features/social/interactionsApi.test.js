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

  it("toggles a like for the current user", async () => {
    const removeLike = chain({ data: null, error: null });
    const addLike = chain({ data: { dump_id: "dump-1", user_id: "me" }, error: null });
    from.mockImplementationOnce(() => removeLike).mockImplementationOnce(() => addLike);

    const { unlikeDump, likeDump } = await import("./interactionsApi.js");
    await unlikeDump("dump-1");
    await likeDump("dump-1");

    expect(removeLike.delete).toHaveBeenCalled();
    expect(removeLike.eq).toHaveBeenCalledWith("dump_id", "dump-1");
    expect(removeLike.eq).toHaveBeenCalledWith("user_id", "me");
    expect(addLike.upsert).toHaveBeenCalledWith(
      { dump_id: "dump-1", user_id: "me" },
      { onConflict: "dump_id,user_id" },
    );
  });

  it("creates a trimmed comment for the current user", async () => {
    const query = chain({ data: { id: "comment-1", text: "hello" }, error: null });
    from.mockReturnValue(query);

    const { addComment } = await import("./interactionsApi.js");
    const comment = await addComment("dump-1", "  hello  ");

    expect(comment.text).toBe("hello");
    expect(query.insert).toHaveBeenCalledWith({ dump_id: "dump-1", user_id: "me", text: "hello" });
  });

  it("rejects empty comments", async () => {
    const { addComment } = await import("./interactionsApi.js");

    await expect(addComment("dump-1", "   ")).rejects.toThrow("Comment cannot be empty");
  });

  it("hydrates feed interaction counts and current-user state", async () => {
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
        { id: "c1", dump_id: "dump-1", user_id: "friend", text: "hi", created_at: "2026-09-16T10:00:00Z" },
      ],
      error: null,
    });
    from.mockImplementationOnce(() => likes).mockImplementationOnce(() => comments);

    const { hydrateDumpInteractions } = await import("./interactionsApi.js");
    const result = await hydrateDumpInteractions([
      { id: "dump-1" },
      { id: "dump-2" },
    ]);

    expect(result).toEqual([
      { id: "dump-1", likes: 2, liked: true, comments: [{ id: "c1", from: "friend", text: "hi", created_at: "2026-09-16T10:00:00Z" }] },
      { id: "dump-2", likes: 1, liked: false, comments: [] },
    ]);
  });
});
