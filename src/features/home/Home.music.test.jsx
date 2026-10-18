// @vitest-environment jsdom

import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DumpCard, Viewer } from "./Home.jsx";
import { getActiveAudio, playAudioUrl, stopAudio } from "../music/audioController.js";

vi.mock("./mediaUrl.js", () => ({ getDumpItemMediaUrl: () => null }));
vi.mock("../social/socialApi.js", () => ({ getCurrentUserId: vi.fn(async () => "me") }));

let audioInstances;
class FakeAudio extends EventTarget {
  constructor(url) {
    super();
    this.src = url;
    this.dataset = {};
    this.paused = true;
    this.muted = false;
    this.currentTime = 0;
    this.play = vi.fn(() => {
      this.paused = false;
      this.dispatchEvent(new Event("play"));
      return Promise.resolve();
    });
    this.pause = vi.fn(() => {
      this.paused = true;
      this.dispatchEvent(new Event("pause"));
    });
    audioInstances.push(this);
  }
}

const post = {
  id: "music-1",
  author: "friend",
  mode: "24h",
  postedMinutesAgo: 1,
  likes: 0,
  comments: [],
  items: [{ id: "photo-1", note: "Photo" }],
  musicTrack: { title: "Test track", audio_url: "https://media.example.test/one.mp3" },
};

beforeEach(() => {
  audioInstances = [];
  vi.stubGlobal("Audio", FakeAudio);
});
afterEach(() => {
  cleanup();
  stopAudio();
  vi.unstubAllGlobals();
});

function playFeedMusic() {
  fireEvent.click(screen.getByRole("button", { name: "Play post music" }));
  return getActiveAudio();
}

describe("Feed music", () => {
  it("does not autoplay on mount or rerender, including track changes", () => {
    const { rerender } = render(<DumpCard post={post} />);
    rerender(<DumpCard post={{ ...post, likes: 1 }} />);
    rerender(<DumpCard post={{ ...post, musicTrack: { ...post.musicTrack, audio_url: "https://media.example.test/two.mp3" } }} />);
    expect(audioInstances).toHaveLength(0);
  });

  it("plays, mutes, and unmutes without opening the viewer or restarting the track", async () => {
    const onOpen = vi.fn();
    render(<DumpCard post={post} onOpen={onOpen} />);
    const audio = playFeedMusic();
    audio.currentTime = 12;
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(audio.loop).toBe(true);
    expect(audio.muted).toBe(false);
    expect(audio.dataset.flicdPostId).toBe("music-1");

    fireEvent.click(screen.getByRole("button", { name: "Mute post music" }));
    expect(audio.muted).toBe(true);
    expect(audio.pause).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Play post music" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Mute post music" })).toHaveAttribute("aria-pressed", "true"));
    expect(audio.muted).toBe(false);
    expect(audio.currentTime).toBe(12);
    expect(audioInstances).toHaveLength(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("resumes an owned paused track instead of creating a second source", async () => {
    render(<DumpCard post={post} />);
    const audio = playFeedMusic();
    // Simulate a pause outside React (for example, a browser media control).
    audio.paused = true;
    fireEvent.click(screen.getByRole("button", { name: "Mute post music" }));
    await waitFor(() => expect(audio.play).toHaveBeenCalledTimes(2));
    expect(audio.paused).toBe(false);
    expect(audioInstances).toHaveLength(1);
  });

  it("does not interrupt playing audio when unrelated post data is refreshed", () => {
    const { rerender } = render(<DumpCard post={post} />);
    const audio = playFeedMusic();
    audio.currentTime = 12;
    rerender(<DumpCard post={{ ...post, likes: 2, musicTrack: { ...post.musicTrack } }} />);
    expect(getActiveAudio()).toBe(audio);
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(audio.pause).not.toHaveBeenCalled();
    expect(audio.currentTime).toBe(12);
  });

  it("uses the latest track URL and post identity after rerender", () => {
    const { rerender } = render(<DumpCard post={post} />);
    const updated = { ...post, id: "music-2", musicTrack: { ...post.musicTrack, audio_url: "https://media.example.test/two.mp3" } };
    rerender(<DumpCard post={updated} />);
    const audio = playFeedMusic();
    expect(audio.src).toBe(updated.musicTrack.audio_url);
    expect(audio.dataset.flicdPostId).toBe("music-2");
  });

  it("keeps the open-post action working independently of music controls", () => {
    const onOpen = vi.fn();
    render(<DumpCard post={post} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: "Open post" }));
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(post);
    expect(audioInstances).toHaveLength(0);
  });

  it("stops and resets owned audio when navigating away from the card", () => {
    const { unmount } = render(<DumpCard post={post} />);
    const audio = playFeedMusic();
    audio.currentTime = 12;
    unmount();
    expect(audio.pause).toHaveBeenCalledTimes(1);
    expect(audio.currentTime).toBe(0);
    expect(getActiveAudio()).toBeNull();
  });

  it("does not stop another post's audio when an inactive card unmounts", () => {
    const { unmount } = render(<DumpCard post={post} />);
    const otherAudio = playAudioUrl("https://media.example.test/other.mp3");
    otherAudio.dataset.flicdPostId = "other-post";
    unmount();
    expect(getActiveAudio()).toBe(otherAudio);
    expect(otherAudio.pause).not.toHaveBeenCalled();
  });

  it("handles a blocked unmute without claiming successful playback", async () => {
    render(<DumpCard post={post} />);
    const audio = playFeedMusic();
    fireEvent.click(screen.getByRole("button", { name: "Mute post music" }));
    audio.play.mockRejectedValueOnce(new Error("Playback blocked"));
    playFeedMusic();
    await waitFor(() => expect(audio.muted).toBe(true));
    expect(screen.getByRole("button", { name: "Play post music" })).toHaveAttribute("aria-pressed", "false");
  });

  it("renders a track without an audio URL without creating a player", () => {
    render(<DumpCard post={{ ...post, musicTrack: { title: "Unavailable track" } }} />);
    expect(screen.getByLabelText("Post music")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Play post music" })).not.toBeInTheDocument();
    expect(audioInstances).toHaveLength(0);
  });
});

describe("Viewer music lifecycle", () => {
  it("keeps playing through a view acknowledgement and stops when the viewer closes", () => {
    const oncePost = { ...post, mode: "once", viewed: false };
    const { rerender, unmount } = render(<Viewer post={oncePost} currentUserId="me" />);
    const audio = getActiveAudio();
    audio.currentTime = 12;
    fireEvent.click(screen.getByRole("button", { name: "Tap to view once" }));
    rerender(<Viewer post={{ ...oncePost, viewed: true }} currentUserId="me" />);
    expect(getActiveAudio()).toBe(audio);
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(audio.pause).not.toHaveBeenCalled();
    expect(audio.currentTime).toBe(12);
    unmount();
    expect(getActiveAudio()).toBeNull();
    expect(audio.pause).toHaveBeenCalledTimes(1);
  });

  it("stops the previous track when switching viewer sessions", () => {
    const { rerender } = render(<Viewer post={post} currentUserId="me" />);
    const first = getActiveAudio();
    const next = { ...post, id: "music-2", musicTrack: { ...post.musicTrack, audio_url: "https://media.example.test/two.mp3" } };
    rerender(<Viewer post={next} currentUserId="me" />);
    expect(first.pause).toHaveBeenCalledTimes(1);
    expect(getActiveAudio().src).toBe(next.musicTrack.audio_url);
  });
});
