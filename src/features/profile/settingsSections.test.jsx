/** @vitest-environment jsdom */
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Profile from "./Profile.jsx";

const { signOut } = vi.hoisted(() => ({
  signOut: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      signOut,
    },
  },
}));

const baseTheme = {
  background: "#111",
  accent: "#ff72b6",
  message: "Hello",
  statusEmoji: "✨",
  status: "online",
  showBoards: true,
  showMusic: true,
  favoriteArtist: "",
};

const baseProfile = {
  handle: "you",
  displayName: "You",
  bio: "",
  avatarUrl: "",
  followers: 10,
  following: 5,
};

describe("Settings roadmap sections", () => {
  it("shows future settings reference points after opening Settings", () => {
    render(
      <Profile
        profile={baseProfile}
        activeSpace={{ id: "main", handle: "you", label: "Main" }}
        theme={baseTheme}
        boards={[]}
        onEditProfile={vi.fn()}
        onCustomize={vi.fn()}
        onSwitchSpaces={vi.fn()}
        onOpenBoards={vi.fn()}
        onCustomizeBoards={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    expect(screen.getByText("Account & Security")).toBeTruthy();
    expect(screen.getByText("Privacy & Safety")).toBeTruthy();
    expect(screen.getByText("Notifications")).toBeTruthy();
    expect(screen.getByText("Content Preferences")).toBeTruthy();
    expect(screen.getByText("Appearance")).toBeTruthy();
    expect(screen.getByText("Data & Storage")).toBeTruthy();
    expect(screen.getByText("Help & Support")).toBeTruthy();
    expect(screen.getByText("About Flic'd")).toBeTruthy();
  });
});
