import { describe, expect, it, vi } from "vitest";

const from = vi.hoisted(() => vi.fn());

vi.mock("../../lib/supabase", () => ({
  supabase: { from },
}));

function chain(result) {
  const api = {
    select: vi.fn(() => api),
    eq: vi.fn(() => api),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  };
  return api;
}

describe("relationship counts", () => {
  it("returns the stored profile follower and following counts", async () => {
    const profile = chain({
      data: { follower_count: 7, following_count: 4 },
      error: null,
    });
    from.mockReturnValue(profile);

    const { getRelationshipCounts } = await import("./socialApi.js");
    const result = await getRelationshipCounts("person-2");

    expect(result).toEqual({ followers: 7, following: 4 });
    expect(profile.eq).toHaveBeenCalledWith("id", "person-2");
  });
});
