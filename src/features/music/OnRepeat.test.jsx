// @vitest-environment jsdom

import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  getMusicTracks: vi.fn(),
  setProfileMusicTrack: vi.fn(),
  stopAudio: vi.fn(),
  getActiveAudio: vi.fn(() => null),
  playAudioUrl: vi.fn(),
  pauseAudio: vi.fn(),
  resumeAudio: vi.fn(),
}));

vi.mock("./musicApi.js", () => ({
  getMusicTracks: mocks.getMusicTracks,
  setProfileMusicTrack: mocks.setProfileMusicTrack,
}));
vi.mock("./audioController.js", () => ({
  getActiveAudio: mocks.getActiveAudio,
  pauseAudio: mocks.pauseAudio,
  playAudioUrl: mocks.playAudioUrl,
  resumeAudio: mocks.resumeAudio,
  stopAudio: mocks.stopAudio,
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
    mocks.getMusicTracks.mockResolvedValue([song]);
    mocks.setProfileMusicTrack.mockResolvedValue({ profile_music_track_id: song.id });

    render(<OnRepeat track={null} onTrackChange={() => {}} />);

    expect(await screen.findByRole("searchbox", { name: "Search profile music" })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("option"));

    await waitFor(() => {
      expect(mocks.setProfileMusicTrack).toHaveBeenCalledWith("song-1");
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
