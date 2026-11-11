import { describe, expect, it, vi } from "vitest";
import { supabase } from '../../lib/supabase';
import { testAuthScope } from '../../../tests/security/testAuthScope.js';

const { upload, remove, getUser } = vi.hoisted(() => ({ upload: vi.fn(), remove: vi.fn(), getUser: vi.fn() }));

vi.mock("../../lib/supabase", () => ({
  createAccountClient: () => supabase,
  supabase: {
    auth: { getUser },
    storage: {
      from: vi.fn(() => ({ upload, remove })),
    },
  },
}));

describe("media upload helper", () => {
  it("stops a multi-file upload and avoids cross-session cleanup after its auth generation expires", async () => {
    const { uploadDumpImages } = await import("./mediaUpload.js");
    upload.mockReset(); remove.mockReset();
    getUser.mockResolvedValue({ data: { user: { id: "A" } }, error: null });
    let finish;
    upload.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue({ data: { path: "A/second.jpg" }, error: null });
    let active = true;
    const file = new File(["synthetic"], "one.jpg", { type: "image/jpeg" });
    const result = uploadDumpImages([file, file], testAuthScope('A', () => active)).catch(error => error);
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    active = false; finish({ data: { path: "A/first.jpg" }, error: null });
    expect(await result).toBeInstanceOf(Error);
    expect(upload).toHaveBeenCalledTimes(1); expect(remove).not.toHaveBeenCalled();
    upload.mockClear(); remove.mockClear();
  });
  it("rejects unsupported files and files larger than 20 MB", async () => {
    const { validateMediaFile, MAX_MEDIA_SIZE } = await import("./mediaUpload.js");
    const badType = new File(["x"], "note.gif", { type: "image/gif" });
    const tooLarge = new File([new Uint8Array(MAX_MEDIA_SIZE + 1)], "large.jpg", { type: "image/jpeg" });

    expect(() => validateMediaFile(badType)).toThrow(/jpeg, png, and webp/i);
    expect(() => validateMediaFile(tooLarge)).toThrow(/20 mb or smaller/i);
  });

  it("uploads valid files under the authenticated user's folder", async () => {
    const { uploadDumpImages } = await import("./mediaUpload.js");
    const file = new File(["photo"], "photo.jpg", { type: "image/jpeg" });
    getUser.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });
    upload.mockResolvedValue({ data: { path: "user-123/generated.jpg" }, error: null });

    const paths = await uploadDumpImages([file], testAuthScope('user-123'));

    expect(paths).toEqual(["user-123/generated.jpg"]);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0][0]).toMatch(/^user-123\/.+\.jpg$/);
    expect(upload.mock.calls[0][1]).toBe(file);
    expect(upload.mock.calls[0][2]).toMatchObject({
      cacheControl: "60",
      contentType: "image/jpeg",
      upsert: false,
    });
  });
});
