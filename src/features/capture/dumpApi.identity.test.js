import { it, expect, vi } from "vitest";
import { testAuthScope } from '../../../tests/security/testAuthScope.js';
const { from, itemsInsert } = vi.hoisted(() => ({ from: vi.fn(), itemsInsert: vi.fn().mockResolvedValue({ error: null }) }));
vi.mock("../../lib/supabase", () => ({ supabase: { from }, createAccountClient: () => ({ from }) }));
vi.mock("../social/socialApi.js", () => ({ getCurrentUserId: async () => "owner", getFollowingIds: vi.fn() }));
vi.mock("../music/musicApi.js", () => ({ hydrateMusicTracks: vi.fn() }));
import { createDump } from "./dumpApi.js";
it.each(["dump", "roll"])("returns the persisted source identity/position for new %s photos without a forbidden once-item reread", async (type) => {
  from.mockImplementation(table => table === "dumps" ? { insert: () => ({ select: () => ({ single: async () => ({ data: { id: "post" }, error: null }) }) }) } : { insert: itemsInsert });
  const result = await createDump({ type, expiry: "24h", items: [{ note: "one", imagePath: "owner/one.png" }, { note: "two", imagePath: "owner/two.png" }] }, testAuthScope('owner'));
  expect(result.dump_items).toHaveLength(2); expect(result.dump_items[1].position).toBe(1);
  expect(result.dump_items[1].id).toMatch(/^[0-9a-f-]{36}$/); expect(itemsInsert.mock.calls.at(-1)[0]).toEqual(result.dump_items);
});
