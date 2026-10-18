import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, from, storageFrom, createSignedUrl, getPublicUrl } = vi.hoisted(() => ({
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
  getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
  storageFrom.mockReturnValue({ createSignedUrl, getPublicUrl });
  createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://signed.example.test/private" }, error: null });
  getPublicUrl.mockReturnValue({ data: { publicUrl: "https://cdn.example.test/legacy" } });
});

describe("Board snapshot privacy", () => {
  it("signs an owner's private Board snapshot rather than generating a public URL", async () => {
    from.mockReturnValue(tableWith([{
      id: "saved-1", saved_image_path: "owner/boards/b1/p1.jpg",
      snapshot_bucket: "flicd-archive",
    }]));
    const items = await getBoardItems();
    expect(items[0].saved_image_url).toContain("signed.example.test");
    expect(storageFrom).toHaveBeenCalledWith("flicd-archive");
    expect(createSignedUrl).toHaveBeenCalledWith("owner/boards/b1/p1.jpg", 600);
    expect(getPublicUrl).not.toHaveBeenCalled();
  });

  it("continues displaying legacy Board snapshots during the staged migration", async () => {
    from.mockReturnValue(tableWith([{
      id: "saved-old", saved_image_path: "owner/boards/legacy.jpg",
      snapshot_bucket: "flicd-media",
    }]));
    const items = await getBoardItems();
    expect(items[0].saved_image_url).toBe("https://cdn.example.test/legacy");
    expect(getPublicUrl).toHaveBeenCalledWith("owner/boards/legacy.jpg");
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("fails closed if the owner cannot sign a private snapshot", async () => {
    from.mockReturnValue(tableWith([{
      id: "saved-denied", saved_image_path: "owner/boards/denied.jpg",
      snapshot_bucket: "flicd-archive",
    }]));
    createSignedUrl.mockResolvedValueOnce({ data: null, error: new Error("Forbidden") });
    await expect(getBoardItems()).rejects.toThrow("Forbidden");
    expect(getPublicUrl).not.toHaveBeenCalled();
  });
});
