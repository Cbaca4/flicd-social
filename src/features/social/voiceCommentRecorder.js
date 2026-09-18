const MIME_TYPE_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];
export const MAX_VOICE_COMMENT_DURATION = 30;

export function getSupportedVoiceMimeType(MediaRecorderCtor = globalThis.MediaRecorder) {
  if (!MediaRecorderCtor) return "";
  if (typeof MediaRecorderCtor.isTypeSupported !== "function") return "";
  return MIME_TYPE_CANDIDATES.find((type) => MediaRecorderCtor.isTypeSupported(type)) || "";
}

export function createVoiceCommentRecorder({
  getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices),
  MediaRecorder = globalThis.MediaRecorder,
  mimeType = null,
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
    const selectedMimeType = mimeType || getSupportedVoiceMimeType(MediaRecorder);\n    recorder = selectedMimeType ? new MediaRecorder(stream, { mimeType: selectedMimeType }) : new MediaRecorder(stream);
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
      blob = new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" });
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
