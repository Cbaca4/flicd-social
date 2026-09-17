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
  let cancelled = false;
  const chunks = [];
  const listeners = new Set();

  function notify() {
    listeners.forEach((listener) => listener(state));
  }

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
    cancelled = false;
    clearStopTimer();

    recorder.ondataavailable = (event) => {
      if (!cancelled && event?.data?.size) chunks.push(event.data);
    };
    recorder.onstop = () => {
      clearStopTimer();
      stream?.getTracks?.().forEach((track) => track.stop());
      if (cancelled) {
        blob = null;
        chunks.length = 0;
        state = "idle";
        return;
      }
      blob = new Blob(chunks, { type: recorder.mimeType || mimeType });
      state = "review";
      notify();
    };

    recorder.start();
    state = "recording";
    notify();
    stopTimer = setTimeoutFn(() => stop(), MAX_VOICE_COMMENT_DURATION * 1000);
  }

  function stop() {
    if (state !== "recording" || !recorder) return;
    clearStopTimer();
    recorder.stop();
  }

  function cancel() {
    clearStopTimer();
    if (state === "recording" && recorder) {
      cancelled = true;
      recorder.stop();
    }
    blob = null;
    chunks.length = 0;
    state = "idle";
    notify();
  }

  function subscribe(listener) {
    if (typeof listener !== "function") return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    start,
    stop,
    cancel,
    subscribe,
    getState: () => state,
    getBlob: () => blob,
  };
}
