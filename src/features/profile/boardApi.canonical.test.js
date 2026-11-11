import { beforeEach, expect, it, vi } from "vitest";
import {testAuthScope} from '../../../tests/security/testAuthScope.js';
const { json, getUser, from, storageFrom } = vi.hoisted(() => ({ json: vi.fn(), getUser: vi.fn(), from: vi.fn(), storageFrom: vi.fn() }));
vi.mock("../../lib/supabase", () => ({ supabase: { auth: { getUser }, from, storage: { from: storageFrom } } }));
vi.mock("../home/mediaSessionApi.js", () => ({ mediaApi: { json } }));
import { saveBoardItem, getBoardItems, linkBoardItem, deleteBoardItem, removeKeep } from "./boardApi.js";
const keep = { id: "keep", source_dump_id: "post", source_item_id: "photo", source_author_id: "creator-id", source_username: "renamed", item_position: 7, saved_note: "photo seven", board_ids: ["one", "two"], is_own_photo: false };
beforeEach(() => { vi.clearAllMocks(); getUser.mockResolvedValue({ data: { user: { id: "saver" } } }); json.mockResolvedValue(keep); });
it("saves the original photo through trusted authorization, never copying or signing Storage", async () => {
  await saveBoardItem({ dumpId: "post", itemPosition: 7, boardId: "one" },testAuthScope('saver'));
  expect(json).toHaveBeenCalledWith("keeps/save", { dumpId: "post", itemPosition: 7, boardId: "one" },{authScope:expect.objectContaining({user:'saver'})});
  expect(storageFrom).not.toHaveBeenCalled(); expect(from).not.toHaveBeenCalled();
});
it("binds selected source item identity as well as original position", async () => {
  await saveBoardItem({ dumpId: "post", itemPosition: 7, itemId: "photo", boardId: "one" },testAuthScope('saver'));
  expect(json).toHaveBeenCalledWith("keeps/save", { dumpId: "post", itemPosition: 7, itemId: "photo", boardId: "one" },{authScope:expect.objectContaining({user:'saver'})});
});
it.each([undefined, null, "7", -1, 1.5])("rejects malformed original position %s without coercion", async (itemPosition) => {
  await expect(saveBoardItem({ dumpId: "post", itemPosition, boardId: "one" },testAuthScope('saver'))).rejects.toThrow(/position/i);
  expect(json).not.toHaveBeenCalled();
});
it("lists one canonical photo across memberships with current stable creator identity", async () => {
  json.mockResolvedValue([keep]); const items = await getBoardItems("two",testAuthScope('saver'));
  expect(items).toHaveLength(1); expect(items[0]).toMatchObject({ id: "keep", dump_id: "post", item_position: 7, source_author_id: "creator-id", board_ids: ["one", "two"] });
  expect(await getBoardItems("absent",testAuthScope('saver'))).toEqual([]); expect(storageFrom).not.toHaveBeenCalled();
});
it("links a previously authorized Keep without re-saving an expired post", async () => {
  await linkBoardItem("keep", "three",testAuthScope('saver')); expect(json).toHaveBeenCalledWith("keeps/link", { keepId: "keep", boardId: "three" },{authScope:expect.objectContaining({user:'saver'})});
});
it("removes only the selected membership, separately from an unorganized underlying Keep", async () => {
  await deleteBoardItem("keep", "one",testAuthScope('saver')); expect(json).toHaveBeenLastCalledWith("keeps/unlink", { keepId: "keep", boardId: "one" },{authScope:expect.objectContaining({user:'saver'})});
  await removeKeep("keep",testAuthScope('saver')); expect(json).toHaveBeenLastCalledWith("keeps/remove", { keepId: "keep" },{authScope:expect.objectContaining({user:'saver'})}); expect(storageFrom).not.toHaveBeenCalled();
});
it("propagates denial without a legacy signing or Storage fallback", async () => {
  json.mockRejectedValue(new Error("media_denied")); await expect(getBoardItems(null,testAuthScope('saver'))).rejects.toThrow("media_denied"); expect(from).not.toHaveBeenCalled(); expect(storageFrom).not.toHaveBeenCalled();
});
