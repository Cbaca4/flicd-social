import { describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const from = vi.fn();

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: { getUser },
    from,
  },
}));

function chain(result) {
  const api = {
    select: vi.fn(() => api),
    eq: vi.fn(() => api),
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
  };
  return api;
}

describe("social API", () => {
  it("follows a public profile as accepted", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "me" } }, error: null });
    from.mockReturnValue(chain({ data: { id: "follow-1", status: "accepted" }, error: null }));

    const { followUser } = await import("./socialApi.js");
    const result = await followUser("person-1");

    expect(result.status).toBe("accepted");
  });

  it("returns onboarding suggestions ordered by shared interests", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "me" } }, error: null });
    const profileApi = chain({ data: { interests: ["Music", "Gaming"] }, error: null });
    const peopleApi = chain({
      data: [
        { id: "a", username: "musicfan", interests: ["Music"] },
        { id: "b", username: "traveler", interests: ["Travel"] },
      ],
      error: null,
    });
    from.mockImplementation((table) => table === "profiles" ? (peopleApi.select.mockImplementation(() => peopleApi), peopleApi) : profileApi);

    const { getPeopleSuggestions } = await import("./socialApi.js");
    const people = await getPeopleSuggestions({ limit: 10 });

    expect(people[0].id).toBe("a");
  });
});
