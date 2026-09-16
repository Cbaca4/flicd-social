/** @vitest-environment jsdom */
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Profile from "./Profile.jsx";

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

describe("Profile edit action", () => {
  it("renders an Edit Profile button that calls onEditProfile", async () => {
    const onEditProfile = vi.fn();

    render(
      <Profile
        profile={baseProfile}
        activeSpace={{ id: "main", handle: "you", label: "Main" }}
        theme={baseTheme}
        boards={[]}
        onEditProfile={onEditProfile}
        onCustomize={vi.fn()}
        onSwitchSpaces={vi.fn()}
        onOpenBoards={vi.fn()}
        onCustomizeBoards={vi.fn()}
      />
    );

    const button = screen.getByRole("button", { name: "Edit Profile" });
    button.click();

    expect(onEditProfile).toHaveBeenCalledTimes(1);
  });
});
