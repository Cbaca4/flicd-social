import { beforeEach, it, expect, vi } from "vitest";
import { testAuthScope } from '../../../tests/security/testAuthScope.js';

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("../../lib/supabase", () => ({
  supabase: { from },
  createAccountClient: () => ({ from }),
}));
vi.mock("../social/socialApi.js", () => ({
  getCurrentUserId: async () => "owner",
  getFollowingIds: vi.fn(),
}));
vi.mock("../music/musicApi.js", () => ({ hydrateMusicTracks: vi.fn() }));

import { createDump } from "./dumpApi.js";

beforeEach(() => { from.mockReset(); });

it.each(["dump", "roll"])("creates %s with no INSERT RETURNING, then reads the committed row while retaining source identity/position", async (type) => {
  let inserted;
  const sequence = [];
  const insert = vi.fn(async (row) => {
    sequence.push("insert");
    inserted = row;
    return { error: null };
  });
  const insertItems = vi.fn(async () => {
    sequence.push("items");
    return { error: null };
  });
  const single = vi.fn(async () => {
    sequence.push("read");
    return { data: { ...inserted, created_at: "2026-11-13T00:00:00Z" }, error: null };
  });
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  from.mockImplementation((table) => table === "dumps"
    ? { insert, select }
    : { insert: insertItems });

  const result = await createDump({
    type,
    expiry: "24h",
    items: [{ note: "one", imagePath: "owner/one.png" }, { note: "two", imagePath: "owner/two.png" }],
  }, testAuthScope("owner"));

  expect(sequence).toEqual(["insert", "items", "read"]);
  expect(insert).toHaveBeenCalledTimes(1);
  expect(inserted.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(inserted.user_id).toBe("owner");
  expect(select).toHaveBeenCalledWith("*");
  expect(eq).toHaveBeenCalledWith("id", inserted.id);
  expect(result.id).toBe(inserted.id);
  expect(result.created_at).toBe("2026-11-13T00:00:00Z");
  expect(result.dump_items).toHaveLength(2);
  expect(result.dump_items[1].position).toBe(1);
  expect(result.dump_items[1].id).toMatch(/^[0-9a-f-]{36}$/);
  expect(result.dump_items.every(item => item.dump_id === inserted.id)).toBe(true);
  expect(insertItems).toHaveBeenCalledWith(result.dump_items);
});

it("fails closed when the insert is rejected, without trying to insert items or read a nonexistent post", async () => {
  const denied = new Error("row-level security denied");
  const insert = vi.fn(async () => ({ error: denied }));
  const select = vi.fn();
  const insertItems = vi.fn();
  from.mockImplementation(table => table === "dumps"
    ? { insert, select }
    : { insert: insertItems });

  await expect(createDump({ type: "dump", expiry: "24h" }, testAuthScope("owner"))).rejects.toBe(denied);
  expect(insert).toHaveBeenCalledTimes(1);
  expect(select).not.toHaveBeenCalled();
  expect(insertItems).not.toHaveBeenCalled();
});

it("does not report success if the separately fetched committed row is inaccessible", async () => {
  const denied = new Error("post cannot be read");
  const insert = vi.fn(async () => ({ error: null }));
  const single = vi.fn(async () => ({ data: null, error: denied }));
  const insertItems = vi.fn(async () => ({ error: null }));
  from.mockImplementation(table => table === "dumps"
    ? { insert, select: () => ({ eq: () => ({ single }) }) }
    : { insert: insertItems });

  await expect(createDump({ type: "dump", expiry: "24h" }, testAuthScope("owner"))).rejects.toBe(denied);
  expect(single).toHaveBeenCalledTimes(1);
});
