import { describe, expect, it, vi } from "vitest";

describe("voice comment recorder", () => {
  it("starts recording with microphone input and exposes recording state", async () => {
    const { createVoiceCommentRecorder } = await import("./voiceCommentRecorder.js");
    const stream = { getTracks: () => [{ stop: vi.fn() }] };
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const recorder = {
      start: vi.fn(),
      stop: vi.fn(),
      state: "inactive",
      ondataavailable: null,
      onstop: null,
      mimeType: "audio/webm",
    };
    function MediaRecorder() {
      return recorder;
    }

    const controller = createVoiceCommentRecorder({ getUserMedia, MediaRecorder });
    await controller.start();

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(recorder.start).toHaveBeenCalled();
    expect(controller.getState()).toBe("recording");
  });

  it("moves to review with a blob after the recorder stops", async () => {
    const { createVoiceCommentRecorder } = await import("./voiceCommentRecorder.js");
    const trackStop = vi.fn();
    const stream = { getTracks: () => [{ stop: trackStop }] };
    const recorder = {
      start: vi.fn(),
      stop: vi.fn(),
      ondataavailable: null,
      onstop: null,
      mimeType: "audio/webm",
    };
    function MediaRecorder() {
      return recorder;
    }
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const controller = createVoiceCommentRecorder({ getUserMedia, MediaRecorder });

    await controller.start();
    recorder.ondataavailable({ data: new Blob(["hello"], { type: "audio/webm" }) });
    recorder.onstop();

    expect(controller.getState()).toBe("review");
    expect(controller.getBlob()).toBeInstanceOf(Blob);
    expect(trackStop).toHaveBeenCalled();
  });

  it("notifies subscribers when review is ready", async () => {
    const { createVoiceCommentRecorder } = await import("./voiceCommentRecorder.js");
    const stream = { getTracks: () => [{ stop: vi.fn() }] };
    const recorder = {
      start: vi.fn(),
      stop: vi.fn(),
      ondataavailable: null,
      onstop: null,
      mimeType: "audio/webm",
    };
    function MediaRecorder() {
      return recorder;
    }
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const controller = createVoiceCommentRecorder({ getUserMedia, MediaRecorder });
    const listener = vi.fn();
    controller.subscribe(listener);

    await controller.start();
    recorder.ondataavailable({ data: new Blob(["hello"], { type: "audio/webm" }) });
    recorder.onstop();

    expect(listener).toHaveBeenCalledWith("review");
  });

  it("automatically stops recording at 30 seconds", async () => {
    vi.useFakeTimers();
    try {
      const { createVoiceCommentRecorder } = await import("./voiceCommentRecorder.js");
      const stream = { getTracks: () => [{ stop: vi.fn() }] };
      const recorder = {
        start: vi.fn(),
        stop: vi.fn(),
        ondataavailable: null,
        onstop: null,
        mimeType: "audio/webm",
      };
      function MediaRecorder() {
        return recorder;
      }
      const getUserMedia = vi.fn().mockResolvedValue(stream);
      const controller = createVoiceCommentRecorder({ getUserMedia, MediaRecorder });

      await controller.start();
      vi.advanceTimersByTime(30000);

      expect(recorder.stop).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
