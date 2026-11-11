// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { renderAccount } from '../../../tests/security/renderAccount.jsx';
const render = (ui, options) => renderAccount(ui, 'owner', options);

const { getArchiveDumps, releaseArchiveMedia } = vi.hoisted(() => ({
  getArchiveDumps: vi.fn(), releaseArchiveMedia: vi.fn(),
}));
vi.mock("./archiveApi.js", () => ({ getArchiveDumps, releaseArchiveMedia }));
import Archive from "./Archive.jsx";

const once = {
  id: "once", user_id: "owner", expiry: "once", context: "Own View Once",
  archive: { reason: "view_once" },
  dump_items: [{ id: "once-frame", position: 0, note: "Own once photo", archiveUrl: "blob:once" }],
};
const expired = {
  id: "expired", user_id: "owner", expiry: "24h", context: "Own expired post",
  created_at: "2020-01-01T00:00:00Z", archive: { reason: "24h_expired" },
  dump_items: [{ id: "expired-frame", position: 3, note: "Own expired photo", archiveUrl: "blob:expired" }],
};

beforeEach(() => { vi.clearAllMocks(); getArchiveDumps.mockReset().mockResolvedValue([once, expired]); });
afterEach(cleanup);

describe("owner Archive privacy lifecycle", () => {
  it("keeps legitimate owner media access but never offers a View Once Board shortcut", async () => {
    const onKeep = vi.fn();
    render(<Archive onKeep={onKeep} />);
    const onceCard = (await screen.findByText("Own View Once")).closest("article");
    expect(within(onceCard).getByRole("img", { name: "Own once photo" })).toBeInTheDocument();
    expect(within(onceCard).queryByRole("button", { name: /save frame/i })).not.toBeInTheDocument();
    const expiredCard = screen.getByText("Own expired post").closest("article");
    fireEvent.click(within(expiredCard).getByRole("button", { name: /save frame/i }));
    expect(onKeep).toHaveBeenCalledWith(expect.objectContaining({
      id: "expired", mode: "24h", authorId: "owner",
      items: [expect.objectContaining({ id: "expired-frame", position: 3 })],
    }), 0);
  });

  it("releases owned Blob URLs when the Archive unmounts", async () => {
    const { unmount } = render(<Archive />);
    await screen.findByRole("img", { name: "Own once photo" });
    expect(releaseArchiveMedia).not.toHaveBeenCalledWith([once, expired]);
    unmount();
    expect(releaseArchiveMedia).toHaveBeenCalledWith([once, expired]);
  });

  it("releases a late load after navigation without retaining or rendering its media", async () => {
    let complete;
    getArchiveDumps.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    const { unmount } = render(<Archive />);
    unmount();
    await act(async () => complete([once]));
    expect(releaseArchiveMedia).toHaveBeenCalledWith([once]);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("ignores and releases a superseded StrictMode load rather than replacing the current Archive", async () => {
    let oldLoad, currentLoad;
    getArchiveDumps.mockImplementationOnce(() => new Promise(resolve => { oldLoad = resolve; }))
      .mockImplementationOnce(() => new Promise(resolve => { currentLoad = resolve; }));
    render(<React.StrictMode><Archive /></React.StrictMode>);
    await act(async () => currentLoad([expired]));
    expect(screen.getByRole("img", { name: "Own expired photo" })).toBeInTheDocument();
    await act(async () => oldLoad([once]));
    expect(screen.queryByRole("img", { name: "Own once photo" })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Own expired photo" })).toBeInTheDocument();
    expect(releaseArchiveMedia).toHaveBeenCalledWith([once]);
  });
});
