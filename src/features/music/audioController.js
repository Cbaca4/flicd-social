let activeAudio = null;

export function stopAudio() {
  if (!activeAudio) return;
  activeAudio.pause();
  activeAudio.currentTime = 0;
  activeAudio = null;
}

export function playAudioUrl(url, { loop = true } = {}) {
  stopAudio();
  if (!url) return null;

  const audio = new Audio(url);
  audio.preload = "auto";
  audio.loop = loop;
  activeAudio = audio;

  audio.play().catch(() => {
    if (activeAudio === audio) activeAudio = null;
  });

  return audio;
}
