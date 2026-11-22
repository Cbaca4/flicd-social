import { describe, expect, it, vi } from "vitest";
import { testAuthScope } from '../../../tests/security/testAuthScope.js';

const getUser = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());

vi.mock("../../lib/supabase", () => ({
  supabase: { auth: { getUser }, from },
  createAccountClient: () => ({ from }),
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
  it("does not overwrite a member's chosen username when onboarding checks their profile", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "me", user_metadata: { username: "old-signup-name" } } }, error: null });
    const existing = chain({ data: { id: "me", username: "chosen-handle" }, error: null });
    from.mockImplementationOnce(() => existing);
    const { ensureCurrentProfile } = await import("./socialApi.js");
    await expect(ensureCurrentProfile(testAuthScope("me"))).resolves.toMatchObject({ username: "chosen-handle" });
    expect(existing.upsert).not.toHaveBeenCalled();
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("creates a missing profile only if absent, then re-reads the winning row", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "me", user_metadata: { username: "signup-handle" } } }, error: null });
    const lookup = chain({ data: null, error: null });
    const insert = chain({ data: null, error: null });
    const winner = chain({ data: { id: "me", username: "signup-handle" }, error: null });
    from.mockImplementationOnce(() => lookup).mockImplementationOnce(() => insert).mockImplementationOnce(() => winner);
    const { ensureCurrentProfile } = await import("./socialApi.js");
    await expect(ensureCurrentProfile(testAuthScope("me"))).resolves.toMatchObject({ username: "signup-handle" });
    expect(insert.upsert).toHaveBeenCalledWith(
      { id: "me", username: "signup-handle" },
      { onConflict: "id", ignoreDuplicates: true },
    );
  });
  it("follows a public profile as accepted", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "me" } }, error: null });
    from.mockImplementationOnce(() => chain({ data: { is_private: false }, error: null }))
      .mockImplementationOnce(() => chain({ data: { status: "accepted" }, error: null }));

    const { followUser } = await import("./socialApi.js");
    const result = await followUser("person-1", testAuthScope('me'));

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
