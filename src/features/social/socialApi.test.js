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
    neq: vi.fn(() => api),
    ilike: vi.fn(() => api),
    or: vi.fn(() => api),
    order: vi.fn(() => api),
    limit: vi.fn(() => api),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
    insert: vi.fn(() => api),
    update: vi.fn(() => api),
    upsert: vi.fn(() => api),
    delete: vi.fn(() => api),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return api;
}

describe("social API", () => {
  it("follows a public profile as accepted", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "me" } }, error: null });
    from.mockImplementationOnce(() => chain({ data: { is_private: false }, error: null }))
      .mockImplementationOnce(() => chain({ data: { status: "accepted" }, error: null }));

    const { followUser } = await import("./socialApi.js");
    const result = await followUser("person-1");

    expect(result).toBe("accepted");
  });

  it("orders onboarding suggestions by shared interests", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "me" } }, error: null });
    from.mockImplementationOnce(() => chain({ data: { interests: ["Music", "Gaming"] }, error: null }))
      .mockImplementationOnce(() => chain({ data: [
        { id: "a", username: "musicfan", interests: ["Music"], created_at: "2026-09-01" },
        { id: "b", username: "traveler", interests: ["Travel"], created_at: "2026-09-10" },
      ], error: null }))
      .mockImplementationOnce(() => chain({ data: [], error: null }));

    const { getPeopleSuggestions } = await import("./socialApi.js");
    const people = await getPeopleSuggestions({ limit: 10 });

    expect(people[0].id).toBe("a");
  });
});
