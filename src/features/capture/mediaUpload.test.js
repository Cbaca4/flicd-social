import { describe, expect, it, vi } from "vitest";

const upload = vi.fn();
const remove = vi.fn();
const getUser = vi.fn();

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: { getUser },
    storage: {
      from: vi.fn(() => ({ upload, remove })),
    },
  },
}));

describe("media upload helper", () => {
  it("rejects unsupported files and files larger than 10 MB", async () => {
    const { validateMediaFile, MAX_MEDIA_SIZE } = await import("./mediaUpload.js");
    const badType = new File(["x"], "note.gif", { type: "image/gif" });
    const tooLarge = new File([new Uint8Array(MAX_MEDIA_SIZE + 1)], "large.jpg", { type: "image/jpeg" });

    expect(() => validateMediaFile(badType)).toThrow(/jpeg, png, and webp/i);
    expect(() => validateMediaFile(tooLarge)).toThrow(/10 mb or smaller/i);
  });

  it("uploads valid files under the authenticated user's folder", async () => {
    const { uploadDumpImages } = await import("./mediaUpload.js");
    const file = new File(["photo"], "photo.jpg", { type: "image/jpeg" });
    getUser.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });
    upload.mockResolvedValue({ data: { path: "user-123/generated.jpg" }, error: null });

    const paths = await uploadDumpImages([file]);

    expect(paths).toEqual(["user-123/generated.jpg"]);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0][0]).toMatch(/^user-123\/.+\.jpg$/);
    expect(upload.mock.calls[0][1]).toBe(file);
    expect(upload.mock.calls[0][2]).toMatchObject({
      cacheControl: "31536000",
      contentType: "image/jpeg",
      upsert: false,
    });
  });
});
