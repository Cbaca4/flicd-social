import { beforeEach, describe, expect, it, vi } from "vitest";
import {testAuthScope} from '../../../tests/security/testAuthScope.js';

const { json, getUser, from, storageFrom, createSignedUrl, getPublicUrl } = vi.hoisted(() => ({
  json: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  storageFrom: vi.fn(),
  createSignedUrl: vi.fn(),
  getPublicUrl: vi.fn(),
}));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: { getUser },
    from,
    storage: { from: storageFrom },
  },
}));

import { getBoardItems } from "./boardApi.js";
vi.mock("../home/mediaSessionApi.js", () => ({ mediaApi: { json } }));

function tableWith(rows) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    then(resolve, reject) {
      return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
    },
  };
  for (const method of ["select", "eq", "order"]) query[method].mockReturnValue(query);
  return query;
}

beforeEach(() => {
  vi.clearAllMocks();
  json.mockResolvedValue([{ id: "saved-1", source_author_id: "owner", board_ids: [] }]);
  getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
  storageFrom.mockReturnValue({ createSignedUrl, getPublicUrl });
  createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://signed.example.test/private" }, error: null });
  getPublicUrl.mockReturnValue({ data: { publicUrl: "https://cdn.example.test/legacy" } });
});

describe("Board snapshot privacy through canonical authority", () => {
  it("uses trusted private media identity rather than issuing a snapshot signed URL", async () => {
    from.mockReturnValue(tableWith([{
      id: "saved-1", saved_image_path: "owner/boards/b1/p1.jpg",
      snapshot_bucket: "flicd-archive",
    }]));
    const items = await getBoardItems(null,testAuthScope('owner'));
    expect(items[0].source_author_id).toBe("owner");
    expect(json).toHaveBeenCalledWith("keeps/list", {},{authScope:expect.objectContaining({user:'owner'})});
    expect(storageFrom).not.toHaveBeenCalled();
    expect(createSignedUrl).not.toHaveBeenCalled();
    expect(getPublicUrl).not.toHaveBeenCalled();
  });

  it("preserves unverified legacy metadata without restoring public snapshot access", async () => {
    json.mockResolvedValueOnce([{ id: "saved-old", legacy_status: "needs_review", saved_note: "Old memory", board_ids: [] }]);
    from.mockReturnValue(tableWith([{
      id: "saved-old", saved_image_path: "owner/boards/legacy.jpg",
      snapshot_bucket: "flicd-media",
    }]));
    const items = await getBoardItems(null,testAuthScope('owner'));
    expect(items[0]).toMatchObject({ legacy_status: "needs_review", note: "Old memory" });
    expect(items[0].saved_image_url).toBeUndefined();
    expect(getPublicUrl).not.toHaveBeenCalled();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("fails closed on gateway denial without retrying the legacy signer", async () => {
    json.mockRejectedValueOnce(new Error("Forbidden"));
    from.mockReturnValue(tableWith([{
      id: "saved-denied", saved_image_path: "owner/boards/denied.jpg",
      snapshot_bucket: "flicd-archive",
    }]));
    createSignedUrl.mockResolvedValueOnce({ data: null, error: new Error("Forbidden") });
    await expect(getBoardItems(null,testAuthScope('owner'))).rejects.toThrow("Forbidden");
    expect(createSignedUrl).not.toHaveBeenCalled();
    expect(getPublicUrl).not.toHaveBeenCalled();
  });
});
