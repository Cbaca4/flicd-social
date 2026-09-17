import { describe, expect, it, vi } from "vitest";

const getUser = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());

vi.mock("../../lib/supabase", () => ({
  supabase: { auth: { getUser }, from },
}));

function chain(result) {
  const api = {
    select: vi.fn(() => api),
    eq: vi.fn(() => api),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return api;
}

describe("relationship counts", () => {
  it("returns accepted follower and following counts for a profile", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "me" } }, error: null });
    const followers = chain({ data: null, count: 7, error: null });
    const following = chain({ data: null, count: 4, error: null });
    from.mockImplementationOnce(() => followers).mockImplementationOnce(() => following);

    const { getRelationshipCounts } = await import("./socialApi.js");
    const result = await getRelationshipCounts("person-2");

    expect(result).toEqual({ followers: 7, following: 4 });
    expect(followers.eq).toHaveBeenCalledWith("following_id", "person-2");
    expect(followers.eq).toHaveBeenCalledWith("status", "accepted");
    expect(following.eq).toHaveBeenCalledWith("follower_id", "person-2");
    expect(following.eq).toHaveBeenCalledWith("status", "accepted");
  });
});
