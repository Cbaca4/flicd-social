/** @vitest-environment jsdom */
import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const { acknowledge, syncArchive, acknowledgementResult, closeSessions, authListener, loadFeed } = vi.hoisted(() => ({ acknowledge: vi.fn(), syncArchive: vi.fn(), acknowledgementResult: vi.fn(), closeSessions: vi.fn(), authListener: { current: null }, loadFeed: vi.fn() }));
vi.mock("../features/home/mediaSessionApi.js", () => ({ closeAllMediaSessions: closeSessions }));
vi.mock("../lib/supabase", () => ({ supabase: {
  auth: {
    getSession: async () => ({ data: { session: { user: { id: "viewer" } } } }),
    getUser: async () => ({ data: { user: { id: "viewer" } } }),
    onAuthStateChange: (handler) => { authListener.current=handler; return { data: { subscription: { unsubscribe() {} } } }; },
  },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
} }));
vi.mock("../features/capture/dumpApi.js", () => ({
  createDump: vi.fn(), getDumpById: vi.fn(), getPostingLimitStatus: vi.fn(),
  getFeedDumps: loadFeed,
  markDumpViewed: acknowledge,
}));
vi.mock("../features/profile/archiveApi.js", () => ({ syncExpiredArchive: syncArchive }));
vi.mock("../features/profile/boardApi.js", () => ({
  getBoards: async () => [], getBoardItems: async () => [],
  getOrCreateDefaultBoard: vi.fn(), createBoard: vi.fn(), saveBoardItem: vi.fn(),
}));
vi.mock("../features/social/interactionsApi.js", () => ({
  hydrateDumpInteractions: async (posts) => posts, likeDump: vi.fn(), unlikeDump: vi.fn(),
}));
vi.mock("../features/messages/messageApi.js", () => ({ getMessageRequests: async () => [] }));
vi.mock("../features/social/notificationsApi.js", () => ({ getUnreadNotificationCount: async () => 0 }));
vi.mock("./AppShell.jsx", () => ({ default: ({ children }) => <>{children}</> }));
vi.mock("../features/home/Home.jsx", () => ({
  default: ({ dumps, onOpen }) => dumps.length ? <button onClick={() => onOpen(dumps[0])}>Open post</button> : null,
  Viewer: ({ post, onMarkViewed, currentUserId }) => <div data-testid="active-viewer" data-account={currentUserId}>
    <span role="status">{post.viewed ? "Consumed" : "Unconsumed"}</span>
    <button onClick={() => { Promise.resolve(onMarkViewed(post.id, { status: "claimed", dump_id: post.id, claim_id: "10000000-0000-4000-8000-000000000001" })).then(acknowledgementResult).catch(() => {}); }}>Acknowledge view</button>
  </div>,
}));
import FlicdApp from "./FlicdApp.jsx";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
beforeEach(() => {
  vi.clearAllMocks(); syncArchive.mockResolvedValue(undefined);
  loadFeed.mockReset().mockResolvedValue([{ id: "once", expiry: "once", user_id: "owner", dump_items: [], created_at: new Date().toISOString() }]);
});

describe("FlicdApp view acknowledgement", () => {
  it("discards a feed response belonging to the account that signed out", async () => {
    let oldFeed;
    loadFeed.mockImplementationOnce(() => new Promise(resolve => { oldFeed = resolve; })).mockResolvedValueOnce([]);
    render(<FlicdApp />);
    await waitFor(() => expect(oldFeed).toBeTypeOf("function"));
    await act(async () => authListener.current("SIGNED_IN", { user: { id: "another-account" } }));
    await act(async () => oldFeed([{ id: "private-old-account", user_id: "viewer", expiry: "once", dump_items: [] }]));
    expect(screen.queryByRole("button", { name: "Open post" })).not.toBeInTheDocument();
  });
  it("closes capabilities and removes the old viewer when authenticated identity changes", async () => {
    render(<FlicdApp />);
    fireEvent.click(await screen.findByRole("button", { name: "Open post" }));
    expect(screen.getByTestId("active-viewer")).toHaveAttribute("data-account", "viewer");
    await act(async () => authListener.current("SIGNED_IN", { user: { id: "another-account" } }));
    expect(closeSessions).toHaveBeenCalledOnce();
    expect(screen.queryByTestId("active-viewer")).not.toBeInTheDocument();
  });
  it.each(["rejected", "unconfirmed"])("does not consume locally after an %s acknowledgement", async (kind) => {
    if (kind === "rejected") acknowledge.mockRejectedValue(new Error("Connection lost"));
    else acknowledge.mockResolvedValue(false);
    render(<FlicdApp />);
    fireEvent.click(await screen.findByRole("button", { name: "Open post" }));
    const archiveCallsBefore = syncArchive.mock.calls.length;
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Acknowledge view" })));
    expect(screen.getByRole("status")).toHaveTextContent("Unconsumed");
    expect(syncArchive).toHaveBeenCalledTimes(archiveCallsBefore);
    expect(acknowledgementResult).not.toHaveBeenCalled();
  });

  it("returns confirmed consumption without globally archiving on another account's reveal", async () => {
    acknowledge.mockResolvedValue(true);
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<FlicdApp />);
    fireEvent.click(await screen.findByRole("button", { name: "Open post" }));
    const archiveCallsBefore = syncArchive.mock.calls.length;
    syncArchive.mockRejectedValueOnce(new Error("Archive unavailable"));
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge view" }));
    await waitFor(() => expect(acknowledgementResult).toHaveBeenCalledWith(true));
    expect(screen.getByRole("status")).toHaveTextContent("Consumed");
    expect(syncArchive).toHaveBeenCalledTimes(archiveCallsBefore);
  });

  it("updates local consumption only after the database acknowledgement succeeds", async () => {
    let confirm;
    acknowledge.mockImplementation(() => new Promise((resolve) => { confirm = resolve; }));
    render(<FlicdApp />);
    fireEvent.click(await screen.findByRole("button", { name: "Open post" }));
    const archiveCallsBefore = syncArchive.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge view" }));
    await waitFor(() => expect(acknowledge).toHaveBeenCalledWith("once", expect.objectContaining({ status: "claimed", dump_id: "once" })));
    try {
      expect(screen.getByRole("status")).toHaveTextContent("Unconsumed");
      expect(syncArchive).toHaveBeenCalledTimes(archiveCallsBefore);
    } finally {
      await act(async () => confirm(true));
    }
    expect(screen.getByRole("status")).toHaveTextContent("Consumed");
    expect(syncArchive).toHaveBeenCalledTimes(archiveCallsBefore);
  });
});
