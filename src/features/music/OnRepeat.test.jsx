// @vitest-environment jsdom

import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const getMusicTracks = vi.fn();
const setProfileMusicTrack = vi.fn();
const stopAudio = vi.fn();
const getActiveAudio = vi.fn(() => null);
const playAudioUrl = vi.fn();
const pauseAudio = vi.fn();
const resumeAudio = vi.fn();

vi.mock("./musicApi.js", () => ({ getMusicTracks, setProfileMusicTrack }));
vi.mock("./audioController.js", () => ({
  getActiveAudio,
  pauseAudio,
  playAudioUrl,
  resumeAudio,
  stopAudio,
}));

import OnRepeat from "./OnRepeat.jsx";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("OnRepeat", () => {
  const song = {
    id: "song-1",
    title: "Night Drive",
    artist: "Ketsa",
    audio_url: "https://media.example.test/night-drive.mp3",
  };

  it("shows the search picker for a new profile and hides it after selection", async () => {
    getMusicTracks.mockResolvedValue([song]);
    setProfileMusicTrack.mockResolvedValue({ profile_music_track_id: song.id });

    render(<OnRepeat track={null} onTrackChange={() => {}} />);

    expect(await screen.findByRole("searchbox", { name: "Search profile music" })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("option", { name: /Night Drive Ketsa/i }));

    await waitFor(() => {
      expect(setProfileMusicTrack).toHaveBeenCalledWith("song-1");
      expect(screen.queryByRole("searchbox", { name: "Search profile music" })).not.toBeInTheDocument();
      expect(screen.getByText("Night Drive")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Remove profile music" })).toBeInTheDocument();
    });
  });

  it("does not render the picker when a profile already has a song", () => {
    render(<OnRepeat track={song} onTrackChange={() => {}} />);

    expect(screen.queryByRole("searchbox", { name: "Search profile music" })).not.toBeInTheDocument();
    expect(screen.getByText("Night Drive")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove profile music" })).toBeInTheDocument();
  });
});
