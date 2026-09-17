// @vitest-environment jsdom

import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const submitComment = vi.fn();

vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { user: { id: "user-1" } } },
      })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      getUser: vi.fn(async () => ({
        data: { user: { id: "user-1" } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({
            data: { username: "baco" },
            error: null,
          })),
        })),
      })),
    })),
  },
}));

vi.mock("../features/social/commentSubmit.js", () => ({
  submitComment: (...args) => submitComment(...args),
}));

vi.mock("../features/social/interactionsApi.js", () => ({
  hydrateDumpInteractions: vi.fn(async (dumps) => dumps),
  likeDump: vi.fn(),
  unlikeDump: vi.fn(),
}));

vi.mock("../features/capture/dumpApi.js", () => ({
  getFeedDumps: vi.fn(async () => [{
    id: "dump-1",
    space_id: "main",
    user_id: "user-1",
    mood: "late night",
    expiry: "24h",
    created_at: "2026-09-17T01:00:00Z",
    context: "test dump",
    dump_items: [{ position: 0, note: "one moment", image_path: null }],
  }]),
  createDump: vi.fn(),
}));

vi.mock("../features/profile/boardApi.js", () => ({
  getBoards: vi.fn(async () => []),
  getBoardItems: vi.fn(async () => []),
  getOrCreateDefaultBoard: vi.fn(),
  createBoard: vi.fn(),
  saveBoardItem: vi.fn(),
}));

vi.mock("../features/capture/mediaUpload.js", () => ({
  removeDumpImages: vi.fn(),
  uploadDumpImages: vi.fn(),
}));

vi.mock("./AppShell.jsx", () => ({
  default: ({ children }) => <div>{children}</div>,
}));
vi.mock("../features/auth/Auth.jsx", () => ({ default: () => <div>auth</div> }));
vi.mock("../features/profile/Boards.jsx", () => ({ default: () => null }));
vi.mock("../features/profile/BoardStudio.jsx", () => ({ default: () => null }));
vi.mock("../features/capture/CreateChoose.jsx", () => ({ default: () => null }));
vi.mock("../features/capture/CaptureBuilders.jsx", () => ({
  DumpBuilder: () => null,
  RollBuilder: () => null,
}));
vi.mock("../features/messages/Messages.jsx", () => ({ default: () => null }));
vi.mock("../features/profile/Profile.jsx", () => ({ default: () => null }));
vi.mock("../features/profile/ProfileStudio.jsx", () => ({ default: () => null }));
vi.mock("../features/profile/EditProfile.jsx", () => ({ default: () => null }));
vi.mock("../features/discovery/Discovery.jsx", () => ({ default: () => null }));
vi.mock("../features/spaces/SpaceSwitcher.jsx", () => ({ default: () => null }));

vi.mock("../features/home/Home.jsx", () => ({
  default: ({ onOpen }) => (
    <button type="button" onClick={() => onOpen({ id: "dump-1" })}>
      Open post
    </button>
  ),
  Viewer: ({ post, onComment }) => (
    <button
      type="button"
      onClick={() => onComment(post.id, {
        media_type: "audio",
        media_blob: new Blob(["voice"], { type: "audio/webm" }),
      })}
    >
      Send voice comment
    </button>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("FlicdApp comment integration", () => {
  it("routes Viewer multimedia comments through the shared comment action", async () => {
    submitComment.mockResolvedValue({
      id: "comment-1",
      user_id: "user-1",
      text: null,
      media_type: "audio",
      media_url: null,
      media_path: "user-1/comments/audio-1.webm",
      media_metadata: null,
      created_at: "2026-09-17T02:10:00Z",
    });

    const { default: FlicdApp } = await import("./FlicdApp.jsx");
    render(<FlicdApp />);

    fireEvent.click(await screen.findByRole("button", { name: "Open post" }));
    fireEvent.click(await screen.findByRole("button", { name: "Send voice comment" }));

    expect(submitComment).toHaveBeenCalledWith(
      "dump-1",
      expect.objectContaining({ media_type: "audio" }),
    );
  });
});
