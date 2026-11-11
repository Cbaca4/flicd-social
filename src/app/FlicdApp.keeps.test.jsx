/** @vitest-environment jsdom */
import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const { acknowledge, syncArchive, acknowledgementResult, closeSessions, authListener, loadFeed, savePhoto, defaultBoard, newBoard } = vi.hoisted(() => ({ acknowledge: vi.fn(), syncArchive: vi.fn(), acknowledgementResult: vi.fn(), closeSessions: vi.fn(), authListener: { current: null }, loadFeed: vi.fn(), savePhoto: vi.fn(), defaultBoard: vi.fn(), newBoard: vi.fn() }));
const libraryRows = vi.hoisted(() => ({ current: [] }));
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
  createDump: async () => ({ id: "new-post", dump_items: [{ id: "new-first", position: 2 }, { id: "new-selected", position: 7 }] }), getDumpById: vi.fn(), getPostingLimitStatus: async () => ({ remaining: 3 }),
  getFeedDumps: loadFeed,
  markDumpViewed: acknowledge,
}));
vi.mock("../features/profile/archiveApi.js", () => ({ syncExpiredArchive: syncArchive }));
vi.mock("../features/profile/boardApi.js", () => ({
  getBoards: async () => [{ id: "saved", name: "Saved" }], getBoardItems: async () => libraryRows.current,
  getOrCreateDefaultBoard: defaultBoard, createBoard: newBoard, saveBoardItem: savePhoto,
}));
vi.mock("../features/social/interactionsApi.js", () => ({
  hydrateDumpInteractions: async (posts) => posts, likeDump: vi.fn(), unlikeDump: vi.fn(),
}));
vi.mock("../features/messages/messageApi.js", () => ({ getMessageRequests: async () => [] }));
vi.mock("../features/social/notificationsApi.js", () => ({ getUnreadNotificationCount: async () => 0 }));
vi.mock("./AppShell.jsx", () => ({ default: ({ children, onCapture, onNavigate }) => <><button onClick={onCapture}>Capture</button><button onClick={() => onNavigate("boards")}>Boards</button><button onClick={() => onNavigate("archive")}>Archive</button>{children}</> }));
vi.mock("../features/profile/Boards.jsx", () => ({ default: function TestBoards() { const [id] = React.useState(() => crypto.randomUUID()); return <div data-testid="private-library" data-instance={id} />; } }));
vi.mock("../features/profile/Archive.jsx", () => ({ default: function TestArchive() { const [id] = React.useState(() => crypto.randomUUID()); return <div data-testid="private-library" data-instance={id} />; } }));
vi.mock("../features/capture/CreateChoose.jsx", () => ({ default: ({ onPick }) => <><button onClick={() => onPick("dump")}>Choose dump</button><button onClick={() => onPick("roll")}>Choose roll</button></> }));
vi.mock("../features/capture/CaptureBuilders.jsx", () => ({ DumpBuilder: ({ onPost }) => <button onClick={() => onPost({ mood: "", expiry: "24h", channel: "main", items: [{ note: "one" }, { note: "two" }] })}>Post</button>, RollBuilder: ({ onPost }) => <button onClick={() => onPost({ mood: "", expiry: "24h", channel: "main", frameCount: 2, items: [{ note: "one" }, { note: "two" }] })}>Post</button> }));
vi.mock("../features/capture/mediaUpload.js", () => ({ PRIVATE_DUMP_MEDIA_BUCKET: "flicd-dump-private", uploadDumpImages: async () => [], removeDumpImages: vi.fn() }));
vi.mock("../features/home/Home.jsx", () => ({
  default: ({ dumps, onKeep }) => dumps.length ? <button onClick={() => onKeep(dumps[0], 1)}>Keep selected photo</button> : null,
  Viewer: ({ post, onMarkViewed, currentUserId }) => <div data-testid="active-viewer" data-account={currentUserId}>
    <span role="status">{post.viewed ? "Consumed" : "Unconsumed"}</span>
    <button onClick={() => { Promise.resolve(onMarkViewed(post.id, { status: "claimed", dump_id: post.id, claim_id: "10000000-0000-4000-8000-000000000001" })).then(acknowledgementResult).catch(() => {}); }}>Acknowledge view</button>
  </div>,
}));
import FlicdApp from "./FlicdApp.jsx";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
beforeEach(() => {
  vi.clearAllMocks(); syncArchive.mockResolvedValue(undefined); libraryRows.current=[];
  loadFeed.mockReset().mockResolvedValue([{ id: "once", expiry: "once", user_id: "owner", dump_items: [], created_at: new Date().toISOString() }]);
});

describe("Keep original photo identity in FlicdApp", () => {
  it("refreshes canonical membership counts before opening Save to Board", async () => {
    render(<FlicdApp />); const button=await screen.findByRole("button", { name: "Keep selected photo" });
    libraryRows.current=[{ id: "changed-in-boards", board_ids: ["saved"] }];
    fireEvent.click(button);expect(await screen.findByRole("button", { name: /Saved 1 item.*default/ })).toBeInTheDocument();
  });
  it.each(["Boards", "Archive"])("remounts %s on account switch so old private media cannot remain in the new account", async (surface) => {
    render(<FlicdApp />); await screen.findByRole("button", { name: "Keep selected photo" });
    fireEvent.click(screen.getByRole("button", { name: surface }));
    const before=screen.getByTestId("private-library").dataset.instance;
    await act(async () => authListener.current("SIGNED_IN", { user: { id: "another-account" } }));
    expect(screen.queryByTestId("private-library")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: surface }));
    expect(screen.getByTestId("private-library").dataset.instance).not.toBe(before);
  });
  it.each(["dump", "roll"])("retains actual persisted photo positions in a newly posted %s before feed refresh", async (type) => {
    render(<FlicdApp />); await screen.findByRole("button", { name: "Keep selected photo" });
    fireEvent.click(screen.getByRole("button", { name: "Capture" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose " + type }));
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    fireEvent.click(await screen.findByRole("button", { name: "Keep selected photo" }));
    fireEvent.click(await screen.findByRole("button", { name: /Saved.*default/ }));
    await waitFor(() => expect(savePhoto).toHaveBeenCalledWith(expect.objectContaining({ dumpId: "new-post", itemPosition: 7, itemId: "new-selected" }),expect.objectContaining({user:'viewer'})));
  });
  beforeEach(() => {
    loadFeed.mockResolvedValue([{ id: "post", user_id: "author", expiry: "24h", allow_others_to_keep: true, created_at: new Date().toISOString(), dump_items: [{ id: "first", position: 2 }, { id: "selected", position: 7 }] }]);
    defaultBoard.mockResolvedValue({ id: "saved", name: "Saved" }); newBoard.mockResolvedValue({ id: "new", name: "Trips" });
    savePhoto.mockResolvedValue({ id: "canonical", board_ids: ["saved"], source_dump_id: "post" });
  });
  it.each([false, true])("uses persisted position 7, not carousel index 1 (new Board: %s)", async (create) => {
    render(<FlicdApp />); fireEvent.click(await screen.findByRole("button", { name: "Keep selected photo" }));
    if (create) {
      fireEvent.click(await screen.findByRole("button", { name: /New Board/ }));
      fireEvent.change(screen.getByPlaceholderText("e.g. Gym, Memories, Trips"), { target: { value: "Trips" } });
      fireEvent.click(screen.getByRole("button", { name: "Create & Save" }));
    } else fireEvent.click(await screen.findByRole("button", { name: /Saved.*default/ }));
    await waitFor(() => expect(savePhoto).toHaveBeenCalledWith(expect.objectContaining({ dumpId: "post", itemPosition: 7, boardId: create ? "new" : "saved" }),expect.objectContaining({user:'viewer'})));
  });
  it("does not guess a missing original position", async () => {
    loadFeed.mockResolvedValue([{ id: "post", user_id: "author", expiry: "24h", allow_others_to_keep: true, dump_items: [{ position: 2 }, { id: "missing-position" }] }]);
    render(<FlicdApp />); fireEvent.click(await screen.findByRole("button", { name: "Keep selected photo" }));
    await screen.findByText(/Original photo position/); expect(defaultBoard).not.toHaveBeenCalled(); expect(savePhoto).not.toHaveBeenCalled();
  });
});
