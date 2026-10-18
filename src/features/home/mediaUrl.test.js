import { describe, expect, it, vi } from "vitest";

const getPublicUrl = vi.fn(() => ({
  data: { publicUrl: "https://cdn.example.com/flicd-media/photo.jpg" },
}));
const createSignedUrl = vi.fn(async () => ({
  data: { signedUrl: "https://storage.example.test/signed/private.jpg?token=example" },
  error: null,
}));
const from = vi.fn(() => ({ getPublicUrl, createSignedUrl }));

vi.mock("../../lib/supabase", () => ({
  supabase: { storage: { from } },
}));

describe("Dump media URL protection", () => {
  it("retains legacy public media URL support for staged migration", async () => {
    const { getDumpItemMediaUrl } = await import("./mediaUrl.js");
    expect(getDumpItemMediaUrl("user-1/photo.jpg")).toBe(
      "https://cdn.example.com/flicd-media/photo.jpg"
    );
    expect(getPublicUrl).toHaveBeenCalledWith("user-1/photo.jpg");
  });

  it("never constructs public URLs for new private Dump objects", async () => {
    const { getDumpItemMediaUrl, PRIVATE_DUMP_MEDIA_BUCKET } = await import("./mediaUrl.js");
    const before = getPublicUrl.mock.calls.length;
    expect(getDumpItemMediaUrl("user-1/photo.jpg", PRIVATE_DUMP_MEDIA_BUCKET)).toBeNull();
    expect(getDumpItemMediaUrl("user-1/photo.jpg", "unknown-bucket")).toBeNull();
    expect(getPublicUrl.mock.calls.length).toBe(before);
  });

  it("uses a short-lived Storage signed URL for an authorized private image", async () => {
    const { resolveDumpItemMediaUrl, PRIVATE_DUMP_MEDIA_BUCKET, SIGNED_MEDIA_URL_SECONDS } = await import("./mediaUrl.js");
    const url = await resolveDumpItemMediaUrl({ imagePath: "user-1/private.jpg", mediaBucket: PRIVATE_DUMP_MEDIA_BUCKET });
    expect(url).toContain("/signed/private.jpg");
    expect(from).toHaveBeenCalledWith(PRIVATE_DUMP_MEDIA_BUCKET);
    expect(createSignedUrl).toHaveBeenCalledWith("user-1/private.jpg", SIGNED_MEDIA_URL_SECONDS);
    expect(SIGNED_MEDIA_URL_SECONDS).toBeLessThanOrEqual(60);
  });

  it("fails closed when Storage refuses to sign private content", async () => {
    const { resolveDumpItemMediaUrl, PRIVATE_DUMP_MEDIA_BUCKET } = await import("./mediaUrl.js");
    createSignedUrl.mockResolvedValueOnce({ data: null, error: new Error("Forbidden") });
    await expect(resolveDumpItemMediaUrl({ imagePath: "other/file.jpg", mediaBucket: PRIVATE_DUMP_MEDIA_BUCKET })).rejects.toThrow("Forbidden");
  });

  it("returns null for missing media paths", async () => {
    const { getDumpItemMediaUrl, resolveDumpItemMediaUrl } = await import("./mediaUrl.js");
    expect(getDumpItemMediaUrl(null)).toBeNull();
    expect(getDumpItemMediaUrl("")).toBeNull();
    await expect(resolveDumpItemMediaUrl({ imagePath: null })).resolves.toBeNull();
  });
});
