// @vitest-environment jsdom

import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Profile from "./Profile.jsx";
import ProfileStudio from "./ProfileStudio.jsx";
import { DEFAULT_THEME } from "./profileTheme.js";

afterEach(cleanup);

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
  getRelationshipCounts: vi.fn().mockResolvedValue({ followers: 12, following: 8 }),
}));

describe("handheld profile layout", () => {
  it("keeps profile actions in a dedicated responsive action group and renders the bio", () => {
    render(
      <Profile
        profile={{
          handle: "baco",
          displayName: "Baco",
          bio: "Building flic'd one piece at a time.",
          links: [{ label: "Website", url: "https://example.com" }],
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
    expect(document.querySelector(".profile-username-heading")).toBeTruthy();
    expect(document.querySelector(".profile-main-row")).toBeTruthy();
    expect(document.querySelector(".profile-mini-stats")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Edit Profile" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText("@baco")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Website" })).toHaveAttribute("href", "https://example.com");
  });

  it("renders the saved profile photo instead of the fallback initial", () => {
    render(
      <Profile
        profile={{
          id: "user-1",
          handle: "baco",
          avatarUrl: "https://cdn.example/avatar.jpg",
          followers: 12,
          following: 8,
        }}
        activeSpace={{ label: "Personal", handle: "baco" }}
        theme={DEFAULT_THEME}
        boards={[]}
        onEditProfile={() => {}}
        onCustomize={() => {}}
      />,
    );

    expect(screen.getByRole("img", { name: "@baco profile" })).toHaveAttribute(
      "src",
      "https://cdn.example/avatar.jpg",
    );
  });

  it("renders background framing controls without the removed identity controls", () => {
    render(
      <ProfileStudio
        theme={{
          ...DEFAULT_THEME,
          backgroundMedia: {
            url: "https://cdn.example/background.jpg",
            type: "image",
            positionX: 50,
            positionY: 50,
            scale: 1,
          },
        }}
        setTheme={() => {}}
        onClose={() => {}}
        onSave={() => {}}
        profile={{ handle: "baco" }}
      />,
    );

    expect(screen.queryByLabelText("Profile font")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Favorite artist")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Profile status")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Profile message")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Background horizontal position")).toHaveValue("50");
    expect(screen.getByLabelText("Background vertical position")).toHaveValue("50");
    expect(screen.getByLabelText("Background extend zoom")).toHaveValue("1");
    expect(
      screen.getByRole("img", { name: "Background positioning preview" }),
    ).toBeInTheDocument();
  });

  it("keeps the full Profile Studio form usable after removing identity controls", () => {
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

    expect(studio).toHaveAttribute("data-scroll-container", "screen");
    expect(screen.getByText("Sections")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save Profile/i })).toBeInTheDocument();
    expect(screen.queryByLabelText("Favorite artist")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Profile font")).not.toBeInTheDocument();
  });
});
