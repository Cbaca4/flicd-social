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

export function playAudioUrl(
  url,
  { loop = true, muted = false, onFallbackToMuted } = {},
) {
  stopAudio();
  if (!url) return null;

  const audio = new Audio(url);
  audio.preload = "auto";
  audio.loop = loop;
  audio.muted = Boolean(muted);
  activeAudio = audio;

  const play = () => {
    const promise = audio.play();
    if (!promise?.catch) return;
    promise.catch(() => {
      if (activeAudio !== audio) return;

      if (!audio.muted) {
        audio.muted = true;
        onFallbackToMuted?.(audio);
        audio.play().catch(() => {
          if (activeAudio === audio) activeAudio = null;
        });
      } else {
        activeAudio = null;
      }
    });
  };

  play();
  return audio;
}
