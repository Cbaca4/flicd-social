import { describe, expect, it, vi } from "vitest";

const getPublicUrl = vi.fn(() => ({
  data: { publicUrl: "https://cdn.example.com/flicd-media/photo.jpg" },
}));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({ getPublicUrl })),
    },
  },
}));

describe("dump media URL", () => {
  it("resolves an image path into a public Storage URL", async () => {
    const { getDumpItemMediaUrl } = await import("./mediaUrl.js");

    expect(getDumpItemMediaUrl("user-1/photo.jpg")).toBe(
      "https://cdn.example.com/flicd-media/photo.jpg"
    );
    expect(getPublicUrl).toHaveBeenCalledWith("user-1/photo.jpg");
  });

  it("returns null when an item has no image path", async () => {
    const { getDumpItemMediaUrl } = await import("./mediaUrl.js");

    expect(getDumpItemMediaUrl(null)).toBeNull();
    expect(getDumpItemMediaUrl("")).toBeNull();
  });
});
