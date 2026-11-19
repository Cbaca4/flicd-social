// @vitest-environment jsdom

import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  it("never offers a Following action on the owner profile but preserves following statistics", () => {
    render(<Profile profile={{ id: "owner", handle: "baco", followers: 4, following: 7 }}
      activeSpace={{ handle: "baco" }} theme={DEFAULT_THEME} boards={[]} />);
    expect(screen.queryByRole("button", { name: "Following list" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Profile" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share profile" })).toBeInTheDocument();
    expect(screen.getByText("Following")).toBeInTheDocument();
  });

  it("opens Color Studio through Settings and saves a new app hue", async () => {
    const onSaveAppearance = vi.fn().mockResolvedValue(undefined);
    render(<Profile profile={{ id: "owner", handle: "baco" }}
      activeSpace={{ handle: "baco" }} theme={DEFAULT_THEME} boards={[]}
      onSaveAppearance={onSaveAppearance} />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: /Color Studio/ }));
    expect(screen.getByTestId("app-color-studio")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider", { name: "App hue" }), { target: { value: "205" } });
    fireEvent.click(screen.getByRole("button", { name: "Save colors" }));
    await vi.waitFor(() => expect(onSaveAppearance).toHaveBeenCalledWith(expect.objectContaining({
      enabled: true, hue: 205, intensity: 75, mode: "dark",
    })));
  });


  it("renders the cinematic reference hierarchy with functional navigation", () => {
    const onBack = vi.fn();
    const onEditProfile = vi.fn();
    const onNotifications = vi.fn();
    render(<Profile
      profile={{ id: "owner", handle: "cristian", displayName: "Cristian", bio: "little moments, big memories", followers: 4800, following: 682 }}
      activeSpace={{ handle: "cristian" }}
      theme={DEFAULT_THEME}
      boards={[]}
      onBack={onBack}
      onEditProfile={onEditProfile}
      onNotifications={onNotifications}
    />);
    expect(screen.getByLabelText("flic’d")).toBeInTheDocument();
    expect(document.querySelector(".profile-cinematic-topbar")).toBeInTheDocument();
    expect(document.querySelector(".profile-avatar-wrap")).toBeInTheDocument();
    expect(screen.getByText("little moments, big memories")).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "Profile content" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share profile" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onEditProfile).toHaveBeenCalledTimes(1);
    expect(onNotifications).toHaveBeenCalledTimes(1);
  });


  it("opens the complete Boards library directly from the profile even when no Boards are pinned", () => {
    const onOpenBoards = vi.fn();
    const onCustomizeBoards = vi.fn();
    render(
      <Profile
        profile={{ handle: "baco", followers: 0, following: 0 }}
        activeSpace={{ handle: "baco" }}
        theme={DEFAULT_THEME}
        boards={[{ id: "saved", name: "Saved", pinned: false }, { id: "trips", name: "Trips", pinned: false }]}
        onOpenBoards={onOpenBoards}
        onCustomizeBoards={onCustomizeBoards}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Boards" }));
    fireEvent.click(screen.getByRole("button", { name: /View all Boards/ }));
    expect(onOpenBoards).toHaveBeenCalledTimes(1);
    expect(onCustomizeBoards).not.toHaveBeenCalled();
  });


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
    expect(document.querySelector(".profile-username-heading")).toHaveTextContent("@baco");
    expect(document.querySelector(".profile-space-layout")).toBeTruthy();
    expect(document.querySelector(".profile-space-grid")).toBeTruthy();
    expect(document.querySelector(".profile-gallery")).toBeTruthy();
    expect(document.querySelector(".profile-space-side")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Boards" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "On Repeat", exact: true })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Profile Studio", exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Switch spaces", exact: true })).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "Profile content" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Boards", exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Website" })).toHaveAttribute("href", "https://example.com");
  });

  it("shows only the signed-in owner's active posts and never embeds view-once media URLs", () => {
    const onOpenPost = vi.fn();
    const ownDump = { id: "mine", authorId: "owner", type: "dump", mode: "once", items: [{ imagePath: "private/photo.jpg" }] };
    const otherDump = { id: "other", authorId: "stranger", type: "dump", mode: "24h", items: [] };
    const expired = { id: "old", authorId: "owner", type: "roll", expiresAt: Date.now() - 1000, items: [] };
    const ownRoll = { id: "roll", authorId: "owner", type: "roll", mode: "24h", expiresAt: Date.now() + 60000, items: [] };
    render(<Profile profile={{ id: "owner", handle: "baco" }} activeSpace={{ handle: "baco" }}
      theme={DEFAULT_THEME} boards={[]} posts={[ownDump, otherDump, expired, ownRoll]} onOpenPost={onOpenPost} />);
    expect(screen.getAllByRole("button", { name: "Open dump post" })).toHaveLength(1);
    expect(document.querySelector(".profile-gallery img")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open dump post" }));
    expect(onOpenPost).toHaveBeenCalledWith(ownDump);
    fireEvent.click(screen.getByRole("tab", { name: "Rolls" }));
    expect(screen.getAllByRole("button", { name: "Open roll post" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("tab", { name: "Boards" }));
    expect(screen.getByRole("button", { name: /View all Boards/ })).toBeInTheDocument();
  });

  it("removes an active post when its 24-hour deadline passes without leaving the profile", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2030-01-01T00:00:00.000Z"));
      const expiringPost = {
        id: "deadline",
        authorId: "owner",
        type: "dump",
        mode: "24h",
        expiresAt: Date.now() + 1500,
        items: [],
      };
      render(<Profile
        profile={{ id: "owner", handle: "baco" }}
        activeSpace={{ handle: "baco" }}
        theme={DEFAULT_THEME}
        boards={[]}
        posts={[expiringPost]}
      />);
      expect(screen.getByRole("button", { name: "Open dump post" })).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(2000));
      expect(screen.queryByRole("button", { name: "Open dump post" })).not.toBeInTheDocument();
      expect(screen.getByText("No dumps yet")).toBeInTheDocument();
    } finally {
      cleanup();
      vi.useRealTimers();
    }
  });

  it("shows pinned Boards above the photo grid while keeping the Boards tab usable", () => {
    const onOpenBoard = vi.fn();
    const board = { id: "trip", name: "Travel memories", pinned: true, cover_url: "" };
    render(<Profile profile={{ id: "owner", handle: "baco" }} activeSpace={{ handle: "baco" }}
      theme={DEFAULT_THEME} boards={[board]} onOpenBoard={onOpenBoard} posts={[]} />);
    expect(screen.getByText("Pinned Boards")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open Board Travel memories" }));
    expect(onOpenBoard).toHaveBeenCalledWith(board);
    fireEvent.click(screen.getByRole("tab", { name: "Boards" }));
    expect(screen.queryByText("Pinned Boards")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Board Travel memories" })).toBeInTheDocument();
  });

  it("keeps Profile Studio accessible through Settings without showing a profile card", () => {
    const onCustomize = vi.fn();
    render(
      <Profile
        profile={{ handle: "baco", followers: 0, following: 0 }}
        activeSpace={{ handle: "baco" }}
        theme={DEFAULT_THEME}
        boards={[]}
        onCustomize={onCustomize}
      />,
    );

    expect(screen.queryByRole("heading", { name: "Profile Studio" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open Studio" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: /Profile Studio/ }));
    expect(onCustomize).toHaveBeenCalledTimes(1);
  });

  it("keeps compact mobile labels available without changing accessible button names", () => {
    render(
      <Profile
        profile={{
          handle: "baco",
          displayName: "Baco",
          bio: "Building flic'd.",
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

    expect(screen.getByRole("button", { name: "Edit Profile" })).toBeInTheDocument();
    expect(document.querySelector(".profile-action-label--full")).toBeTruthy();
    expect(document.querySelector(".profile-action-label--compact")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Switch spaces", exact: true })).toBeInTheDocument();
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

  it("uses the saved background photo behind the immersive hero without overriding custom section media", () => {
    const backgroundMedia = { url: "https://cdn.example/sunset.jpg", type: "image", positionX: 30, positionY: 60, scale: 1.2 };
    const { rerender } = render(<Profile profile={{ handle: "baco" }} activeSpace={{ handle: "baco" }}
      theme={{ ...DEFAULT_THEME, backgroundMedia }} boards={[]} />);
    const hero = document.querySelector(".profile-space-hero");
    expect(hero.style.backgroundColor).toBe("rgba(22, 15, 30, 0.28)");
    expect(document.querySelector(".profile-background-media img")).toHaveAttribute("src", backgroundMedia.url);

    rerender(<Profile profile={{ handle: "baco" }} activeSpace={{ handle: "baco" }}
      theme={{
        ...DEFAULT_THEME,
        backgroundMedia,
        sectionStyles: {
          ...DEFAULT_THEME.sectionStyles,
          hero: { ...DEFAULT_THEME.sectionStyles.hero, backgroundMedia: { url: "https://cdn.example/custom-header.jpg" } },
        },
      }} boards={[]} />);
    expect(hero.style.backgroundSize).toBe("cover");
    expect(hero.style.backgroundPosition).toBe("50% 50%");
    expect(hero.style.backgroundColor).not.toBe("rgba(22, 15, 30, 0.28)");
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
    expect(screen.getByLabelText("Global roundness")).toBeInTheDocument();
    const adaptiveThemeToggle = screen.getByRole("button", { name: "Adaptive Theme" });
    expect(adaptiveThemeToggle).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(adaptiveThemeToggle);
    expect(adaptiveThemeToggle).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByLabelText("Profile header roundness")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Boards roundness")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Button roundness")).not.toBeInTheDocument();
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
