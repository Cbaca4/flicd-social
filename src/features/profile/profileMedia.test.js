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

  it("uploads a profile background using the optimized/public media contract", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    upload.mockResolvedValue({ data: { path: "user-1/profile/background/background-1.png" }, error: null });
    getPublicUrl.mockReturnValue({ data: { publicUrl: "https://cdn.example/profile-background.png" } });

    const { uploadProfileBackground } = await import("./profileMedia.js");
    const file = new File(["background"], "background.png", { type: "image/png" });

    await expect(uploadProfileBackground(file)).resolves.toMatchObject({
      url: "https://cdn.example/profile-background.png",
      type: "image",
      mimeType: "image/png",
      optimized: false,
    });

    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/profile\/background\/.*\.png$/),
      file,
      expect.objectContaining({ contentType: "image/png", upsert: false }),
    );
  });

  it("rejects oversized profile background videos", async () => {
    const { validateProfileBackgroundVideo, MAX_PROFILE_BACKGROUND_VIDEO_SIZE } = await import("./profileMedia.js");
    const file = {
      type: "video/mp4",
      size: MAX_PROFILE_BACKGROUND_VIDEO_SIZE + 1,
    };

    await expect(validateProfileBackgroundVideo(file)).rejects.toThrow(/30 MB or smaller/i);
  });
