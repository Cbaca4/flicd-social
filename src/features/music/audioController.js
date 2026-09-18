let activeAudio = null;

export function stopAudio() {
  if (!activeAudio) return;
  activeAudio.pause();
  activeAudio.currentTime = 0;
  activeAudio = null;
}

export function getActiveAudio() {
  return activeAudio;
}

export function setAudioMuted(muted) {
  if (!activeAudio) return null;
  activeAudio.muted = Boolean(muted);
  return activeAudio;
}

export function playAudioUrl(url, { loop = true, muted = false, onPlaybackBlocked } = {}) {
  stopAudio();
  if (!url) return null;

  const audio = new Audio(url);
  audio.preload = "auto";
  audio.loop = loop;
  audio.muted = Boolean(muted);
  audio.playsInline = true;
  activeAudio = audio;

  const promise = audio.play();
  promise?.catch?.(() => {
    if (activeAudio !== audio) return;
    onPlaybackBlocked?.(audio);
  });

  return audio;
}

export function pauseAudio() {
  if (!activeAudio) return null;
  activeAudio.pause();
  return activeAudio;
}

export async function resumeAudio() {
  if (!activeAudio) return null;
  try {
    await activeAudio.play();
  } catch {
    return null;
  }
  return activeAudio;
}
