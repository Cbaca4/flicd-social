import { describe, expect, it, vi, beforeEach } from "vitest";

const { getCurrentUserId, getFollowingIds, from } = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(),
  getFollowingIds: vi.fn(),
  from: vi.fn(),
}));

vi.mock("../social/socialApi.js", () => ({
  getCurrentUserId,
  getFollowingIds,
}));

vi.mock("../../lib/supabase", () => ({
  supabase: { from },
}));

import { getFeedDumps, markDumpViewed } from "./dumpApi.js";

function createQuery(result) {
  const query = {
    select: vi.fn(),
    in: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  query.select.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  return query;
}

describe("getFeedDumps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    from.mockReset();
    getCurrentUserId.mockResolvedValue("me");
    getFollowingIds.mockResolvedValue({
      friend: "accepted",
      privateFriend: "accepted",
      pendingUser: "pending",
    });
  });

  it("loads the current user and accepted follows while excluding pending follows", async () => {
    const query = createQuery({
      data: [{ id: "dump-1", user_id: "friend", expiry: "24h" }],
      error: null,
    });
    const viewsQuery = createQuery({ data: [], error: null });
    from.mockImplementationOnce(() => query).mockImplementationOnce(() => viewsQuery);

    const result = await getFeedDumps({ limit: 25, spaceId: "main" });

    expect(result).toEqual([{ id: "dump-1", user_id: "friend", expiry: "24h" }]);
    expect(from).toHaveBeenNthCalledWith(1, "dumps");
    expect(from).toHaveBeenNthCalledWith(2, "dump_views");
    expect(query.in).toHaveBeenCalledWith("user_id", ["me", "friend", "privateFriend"]);
    expect(query.eq).toHaveBeenCalledWith("space_id", "main");
    expect(query.limit).toHaveBeenCalledWith(25);
  });

  it("keeps consumed view-once metadata in the feed with per-account media status", async () => {
    const query = createQuery({
      data: [
        { id: "once-seen", user_id: "friend", expiry: "once" },
        { id: "once-new", user_id: "friend", expiry: "once" },
        { id: "normal", user_id: "friend", expiry: "24h" },
      ],
      error: null,
    });
    const viewsQuery = createQuery({
      data: [{ dump_id: "once-seen" }],
      error: null,
    });
    from.mockImplementationOnce(() => query).mockImplementationOnce(() => viewsQuery);

    await expect(getFeedDumps()).resolves.toEqual([
      { id: "once-seen", user_id: "friend", expiry: "once", viewed: true },
      { id: "once-new", user_id: "friend", expiry: "once", viewed: false },
      { id: "normal", user_id: "friend", expiry: "24h" },
    ]);
  });

  it("does not globally retire once metadata or apply the ordinary 24-hour cutoff to it", async () => {
    const query = createQuery({ data: [{ id: "old-once", expiry: "once", once_viewed_at: "2020-01-01", created_at: "2020-01-01" }, { id: "expired", expiry: "24h", created_at: "2020-01-01" }], error: null });
    from.mockImplementationOnce(() => query).mockImplementationOnce(() => createQuery({ data: [], error: null }));
    await expect(getFeedDumps()).resolves.toEqual([{ id: "old-once", expiry: "once", once_viewed_at: "2020-01-01", created_at: "2020-01-01", viewed: false }]);
  });

  it("returns a useful error when the feed query fails", async () => {
    const error = new Error("feed unavailable");
    from.mockReturnValue(createQuery({ data: null, error }));

    await expect(getFeedDumps()).rejects.toBe(error);
  });

  it("never writes consumption from the browser and acknowledges only a matching server receipt", async () => {
    from.mockReturnValue({ upsert: vi.fn(async () => ({ error: null })) });
    const receipt = { status: "claimed", dump_id: "once", claim_id: "10000000-0000-4000-8000-000000000001" };
    expect(await markDumpViewed("once", receipt)).toBe(true);
    expect(from).not.toHaveBeenCalled();
    expect(await markDumpViewed("once")).toBe(false);
    expect(await markDumpViewed("other-post", receipt)).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });
});
