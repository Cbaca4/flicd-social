import { describe, expect, it, vi } from "vitest";

const getUser = vi.hoisted(() => vi.fn());
const upload = vi.hoisted(() => vi.fn());
const getPublicUrl = vi.hoisted(() => vi.fn());

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: { getUser },
    storage: {
      from: vi.fn(() => ({
        upload,
        getPublicUrl,
      })),
    },
  },
}));

describe("profile photo storage", () => {
  it("uploads a gallery image to the user's profile folder and returns its public URL", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    upload.mockResolvedValue({ data: { path: "user-1/profile/photo-1.png" }, error: null });
    getPublicUrl.mockReturnValue({ data: { publicUrl: "https://cdn.example/profile-photo.png" } });

    const { uploadProfilePhoto } = await import("./profileMedia.js");
    const file = new File(["avatar"], "avatar.png", { type: "image/png" });

    await expect(uploadProfilePhoto(file)).resolves.toBe("https://cdn.example/profile-photo.png");
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/profile\/.*\.png$/),
      file,
      expect.objectContaining({ contentType: "image/png", upsert: false }),
    );
    expect(getPublicUrl).toHaveBeenCalledWith(expect.stringMatching(/^user-1\/profile\/.*\.png$/));
  });
});
