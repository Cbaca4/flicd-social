/** @vitest-environment jsdom */
import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const { authMock, apiMock, profileFromMock } = vi.hoisted(() => ({
  authMock: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    getUser: vi.fn(),
  },
  apiMock: {
    getDumps: vi.fn(),
    getBoards: vi.fn(),
    getBoardItems: vi.fn(),
    getOrCreateDefaultBoard: vi.fn(),
  },
  profileFromMock: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: authMock,
    from: profileFromMock,
  },
}));

vi.mock("../features/capture/dumpApi.js", () => ({
  createDump: vi.fn(),
  getDumps: apiMock.getDumps,
}));

vi.mock("../features/profile/boardApi.js", () => ({
  getBoards: apiMock.getBoards,
  getBoardItems: apiMock.getBoardItems,
  getOrCreateDefaultBoard: apiMock.getOrCreateDefaultBoard,
  createBoard: vi.fn(),
  saveBoardItem: vi.fn(),
}));

vi.mock("../features/auth/Auth.jsx", () => ({ default: () => <div>Auth</div> }));
vi.mock("../features/profile/BoardStudio.jsx", () => ({ default: () => null }));
vi.mock("../features/profile/ProfileStudio.jsx", () => ({ default: () => null }));
vi.mock("../features/profile/EditProfile.jsx", () => ({ default: () => <div>Edit Profile</div> }));
vi.mock("../features/discovery/Discovery.jsx", () => ({ default: () => <div>Discovery</div> }));
vi.mock("../features/messages/Messages.jsx", () => ({ default: () => <div>Messages</div> }));
vi.mock("../features/spaces/SpaceSwitcher.jsx", () => ({ default: () => <div>Spaces</div> }));
vi.mock("../features/profile/Boards.jsx", () => ({ default: () => <div>Boards</div> }));
vi.mock("../features/capture/CreateChoose.jsx", () => ({ default: () => <div>Create</div> }));
vi.mock("../features/capture/CaptureBuilders.jsx", () => ({ DumpBuilder: () => <div>Dump</div>, RollBuilder: () => <div>Roll</div> }));
vi.mock("../app/AppShell.jsx", () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock("../features/profile/Profile.jsx", () => ({
  default: ({ onPublicProfileSelect }) => (
    <button type="button" onClick={() => onPublicProfileSelect?.({
      id: "profile-123",
      username: "maren_",
      display_name: "Maren",
      bio: "moments + coffee",
      avatar_url: "",
      followers: 42,
      following: 18,
      profile_theme: null,
    })}>Open Maren</button>
  ),
}));
vi.mock("../features/home/Home.jsx", () => ({ default: () => <div>Home</div>, Viewer: () => <div>Viewer</div> }));
vi.mock("../features/profile/PublicProfile.jsx", () => ({
  default: ({ profile, onBack }) => (
    <div>
      <h1>@{profile.username}</h1>
      <button type="button" onClick={onBack}>Back</button>
    </div>
  ),
}));

import FlicdApp from "./FlicdApp.jsx";

describe("FlicdApp public profile navigation", () => {
  beforeEach(() => {
    authMock.getSession.mockResolvedValue({ data: { session: { user: { id: "me" } } } });
    authMock.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    authMock.getUser.mockResolvedValue({ data: { user: { id: "me" } } });
    apiMock.getDumps.mockResolvedValue([]);
    apiMock.getBoards.mockResolvedValue([]);
    apiMock.getBoardItems.mockResolvedValue([]);
    apiMock.getOrCreateDefaultBoard.mockResolvedValue({ id: "saved", name: "Saved" });
    profileFromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: "me",
              username: "you",
              display_name: "You",
              bio: "",
              avatar_url: "",
              profile_theme: null,
            },
            error: null,
          }),
        }),
      }),
    });
  });

  it("opens the selected user as a public profile and returns home on back", async () => {
    render(<FlicdApp />);

    fireEvent.click(screen.getByRole("button", { name: "Open Maren" }));

    expect(await screen.findByRole("heading", { name: "@maren_" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByText("Home")).toBeTruthy();
  });
});
