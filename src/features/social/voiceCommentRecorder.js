const DEFAULT_MIME_TYPE = "audio/webm";
export const MAX_VOICE_COMMENT_DURATION = 30;

export function createVoiceCommentRecorder({
  getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices),
  MediaRecorder = globalThis.MediaRecorder,
  mimeType = DEFAULT_MIME_TYPE,
  setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout,
} = {}) {
  let state = "idle";
  let blob = null;
  let stream = null;
  let recorder = null;
  let stopTimer = null;
  const chunks = [];

  function clearStopTimer() {
    if (stopTimer !== null) {
      clearTimeoutFn(stopTimer);
      stopTimer = null;
    }
  }

  async function start() {
    if (state === "recording") return;
    if (typeof getUserMedia !== "function" || typeof MediaRecorder !== "function") {
      throw new Error("Voice recording is not supported in this browser.");
    }

    stream = await getUserMedia({ audio: true });
    recorder = new MediaRecorder(stream, { mimeType });
    chunks.length = 0;
    blob = null;
    clearStopTimer();

    recorder.ondataavailable = (event) => {
      if (event?.data?.size) chunks.push(event.data);
    };
    recorder.onstop = () => {
      clearStopTimer();
      blob = new Blob(chunks, { type: recorder.mimeType || mimeType });
      stream?.getTracks?.().forEach((track) => track.stop());
      state = "review";
    };

    recorder.start();
    state = "recording";
    stopTimer = setTimeoutFn(() => stop(), MAX_VOICE_COMMENT_DURATION * 1000);
  }

  function stop() {
    if (state !== "recording" || !recorder) return;
    clearStopTimer();
    recorder.stop();
  }

  function cancel() {
    clearStopTimer();
    if (state === "recording" && recorder) recorder.stop();
    blob = null;
    chunks.length = 0;
    state = "idle";
  }

  return {
    start,
    stop,
    cancel,
    getState: () => state,
    getBlob: () => blob,
  };
}
