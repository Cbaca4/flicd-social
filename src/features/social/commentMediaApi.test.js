import { beforeEach, describe, expect, it, vi } from "vitest";
import { testAuthScope } from '../../../tests/security/testAuthScope.js';

const uploadCommentMedia = vi.hoisted(() => vi.fn());
const addComment = vi.hoisted(() => vi.fn());

vi.mock("./commentMediaUpload.js", () => ({ uploadCommentMedia }));
vi.mock("./interactionsApi.js", () => ({ addComment }));

describe("comment media API", () => {
  it("forwards a live originating context through upload and comment insertion", async () => {
    const { sendCommentMedia } = await import("./commentMediaApi.js"); const authScope = testAuthScope('user-1');
    const blob = new Blob(["voice"], { type: "audio/webm" });
    await sendCommentMedia("dump-1", { mediaType: "audio", mediaBlob: blob, authScope });
    const passed = uploadCommentMedia.mock.calls[0][1].authScope;
    expect(passed.user).toBe('user-1'); expect(passed.generation).toBe(authScope.generation); expect(passed.isCurrent()).toBe(true);
    expect(addComment).toHaveBeenCalledWith("dump-1", expect.objectContaining({ media_type: "audio" }), passed);
  });
  it("does not attach or clean up old media using the replacement session after upload", async () => {
    let finish; uploadCommentMedia.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { sendCommentMedia } = await import("./commentMediaApi.js"); let active = true;
    const result = sendCommentMedia("post", { mediaType: "audio", mediaBlob: new Blob(["synthetic"], { type: "audio/webm" }), authScope: testAuthScope('A', () => active) }).catch(e => e);
    await vi.waitFor(() => expect(finish).toBeTypeOf("function")); active = false; finish("A/comments/private.webm");
    expect(await result).toBeInstanceOf(Error); expect(addComment).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    uploadCommentMedia.mockResolvedValue("user-1/comments/audio-1.webm");
    addComment.mockResolvedValue({
      id: "comment-1",
      dump_id: "dump-1",
      user_id: "user-1",
      text: null,
      media_type: "audio",
      media_url: null,
      media_path: "user-1/comments/audio-1.webm",
      media_metadata: null,
      created_at: "2026-09-16T23:00:00Z",
    });
  });

  it("uploads an audio blob before saving the audio comment path", async () => {
    const { sendCommentMedia } = await import("./commentMediaApi.js");
    const blob = new Blob(["voice"], { type: "audio/webm" });

    await sendCommentMedia("dump-1", {
      mediaType: "audio",
      mediaBlob: blob,
      authScope: testAuthScope('user-1'),
    });

    expect(uploadCommentMedia).toHaveBeenCalledWith(blob, { mediaType: "audio", authScope: expect.objectContaining({ user: 'user-1' }) });
    expect(addComment).toHaveBeenCalledWith("dump-1", {
      text: null,
      media_type: "audio",
      media_url: null,
      media_path: "user-1/comments/audio-1.webm",
      media_metadata: null,
    }, expect.objectContaining({ user: 'user-1' }));
  });
});
