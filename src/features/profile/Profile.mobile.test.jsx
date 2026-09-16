// @vitest-environment jsdom

import React from "react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Profile from "./Profile.jsx";
import ProfileStudio from "./ProfileStudio.jsx";
import { DEFAULT_THEME } from "./profileTheme.js";

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

vi.mock("../social/socialApi.js", () => ({
  getCurrentProfile: vi.fn().mockResolvedValue({ is_private: false }),
  setPrivateAccount: vi.fn(),
  getPendingFollowRequests: vi.fn().mockResolvedValue([]),
}));

describe("handheld profile layout", () => {
  it("keeps profile actions in a dedicated responsive action group and renders the bio", () => {
    render(
      <Profile
        profile={{
          handle: "baco",
          bio: "Building flic'd one piece at a time.",
          followers: 12,
          following: 8,
        }}
        activeSpace={{ label: "Personal", handle: "baco" }}
        theme={{
          ...DEFAULT_THEME,
          message: "Welcome to my page.",
          status: "Building",
          statusEmoji: "✨",
        }}
        boards={[]}
        onEditProfile={() => {}}
        onCustomize={() => {}}
      />,
    );

    expect(screen.getByText("Building flic'd one piece at a time.")).toHaveClass(
      "profile-bio",
    );
    expect(document.querySelector(".profile-heading")).toBeTruthy();
    expect(document.querySelector(".profile-actions")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Edit Profile" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
  });

  it("keeps the full Profile Studio form usable after editing Favorite artist", () => {
    render(
      <ProfileStudio
        theme={DEFAULT_THEME}
        setTheme={() => {}}
        onClose={() => {}}
        onSave={() => {}}
        profile={{ handle: "baco" }}
      />,
    );

    const studio = screen.getByTestId("profile-studio-screen");
    const artist = screen.getByLabelText("Favorite artist");

    expect(studio).toHaveAttribute("data-scroll-container", "screen");
    fireEvent.change(artist, { target: { value: "Deftones" } });

    expect(artist).toHaveValue("Deftones");
    expect(screen.getByText("Sections")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save Profile/i })).toBeInTheDocument();
  });
});
