import { describe, expect, it, vi, beforeEach } from "vitest";
import { playAudioUrl, stopAudio } from "./audioController.js";

class FakeAudio {
  constructor(url) {
    this.url = url;
    this.loop = false;
    this.preload = "";
    this.currentTime = 0;
    this.pause = vi.fn();
    this.play = vi.fn(() => Promise.resolve());
  }
}

describe("audioController", () => {
  beforeEach(() => {
    vi.stubGlobal("Audio", FakeAudio);
    stopAudio();
  });

  it("keeps one active audio source at a time", async () => {
    const first = playAudioUrl("/first.mp3");
    const second = playAudioUrl("/second.mp3");

    expect(first.pause).toHaveBeenCalledTimes(1);
    expect(second.url).toBe("/second.mp3");
    expect(second.loop).toBe(true);
    expect(second.play).toHaveBeenCalledTimes(1);
  });

  it("stops and resets the active source", () => {
    const audio = playAudioUrl("/track.mp3");
    stopAudio();

    expect(audio.pause).toHaveBeenCalledTimes(1);
    expect(audio.currentTime).toBe(0);
  });

  it("does not create audio for an empty URL", () => {
    expect(playAudioUrl("")).toBeNull();
  });
});
