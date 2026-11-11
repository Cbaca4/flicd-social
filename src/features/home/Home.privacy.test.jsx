// @vitest-environment jsdom

import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderAccount } from '../../../tests/security/renderAccount.jsx';
const render = (ui, options) => renderAccount(ui, 'me', options);
import { Viewer } from "./Home.jsx";
import { resolveDumpItemMediaUrl } from "./mediaUrl.js";
const { claimMedia, loadMedia, closeMedia } = vi.hoisted(() => ({ claimMedia: vi.fn(), loadMedia: vi.fn(), closeMedia: vi.fn() }));
vi.mock("./mediaSessionApi.js", () => ({ createOnceMediaSession: (dumpId) => ({ claim: () => claimMedia(dumpId), loadFrames: loadMedia, close: closeMedia }) }));

vi.mock("./mediaUrl.js", () => ({
  PRIVATE_DUMP_MEDIA_BUCKET: "flicd-dump-private",
  getDumpItemMediaUrl: (path, bucket) => bucket === "flicd-dump-private" ? null : path ? `https://media.example.test/${path}` : null,
  resolveDumpItemMediaUrl: vi.fn(async (item) => item?.imagePath ? `https://media.example.test/signed/${item.imagePath}` : null),
}));
vi.mock("../social/socialApi.js", () => ({ getCurrentUserId: vi.fn(async () => "me") }));

const oncePost = {
  id: "once-1",
  author: "friend",
  mode: "once",
  viewed: false,
  likes: 0,
  comments: [],
  items: [
    { id: "photo-1", imagePath: "one.jpg", mediaBucket: "flicd-dump-private", note: "First private photo" },
    { id: "photo-2", imagePath: "two.jpg", mediaBucket: "flicd-dump-private", note: "Second private photo" },
  ],
};

function renderViewer(post = oncePost, props = {}) {
  return render(<Viewer post={post} currentUserId="me" onMarkViewed={async () => true} {...props} />);
}

function expectNoPrivatePhotosLoaded() {
  expect(screen.queryAllByRole("img")).toHaveLength(0);
}

afterEach(() => { cleanup(); vi.clearAllMocks(); });
beforeEach(() => {
  claimMedia.mockReset().mockImplementation(async (dumpId) => ({ status: "claimed", dump_id: dumpId, claim_id: "10000000-0000-4000-8000-000000000001", items: oncePost.items }));
  loadMedia.mockReset().mockResolvedValue(["blob:first-private-frame", "blob:second-private-frame"]);
  closeMedia.mockReset().mockResolvedValue(undefined);
});

describe("Viewer one-view privacy", () => {
  it.each([false, undefined])("fails closed when the acknowledgement returns %s", async (result) => {
    renderViewer(oncePost, { onMarkViewed: vi.fn().mockResolvedValue(result) });
    fireEvent.click(screen.getAllByRole("button", { name: "Tap to view once" })[0]);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not confirm this view");
    expectNoPrivatePhotosLoaded();
  });

  it("fails closed if no acknowledgement handler was provided", async () => {
    renderViewer(oncePost, { onMarkViewed: undefined });
    fireEvent.click(screen.getAllByRole("button", { name: "Tap to view once" })[0]);
    await screen.findByRole("alert");
    expectNoPrivatePhotosLoaded();
  });

  it("keeps a rejected view locked and permits a confirmed retry", async () => {
    const onMarkViewed = vi.fn().mockRejectedValueOnce(new Error("Network disconnected")).mockResolvedValue(true);
    renderViewer(oncePost, { onMarkViewed });
    fireEvent.click(screen.getAllByRole("button", { name: "Tap to view once" })[0]);
    await screen.findByRole("alert");
    expectNoPrivatePhotosLoaded();
    fireEvent.click(screen.getAllByRole("button", { name: "Tap to view once" })[0]);
    expect(await screen.findByRole("img", { name: "First private photo" })).toBeInTheDocument();
    expect(onMarkViewed).toHaveBeenCalledTimes(2);
  });

  it("does not duplicate claiming or acknowledgement while confirmation is pending", async () => {
    let acknowledge;
    const onMarkViewed = vi.fn(() => new Promise((resolve) => { acknowledge = resolve; }));
    renderViewer(oncePost, { onMarkViewed });
    fireEvent.click(screen.getAllByRole("button", { name: "Tap to view once" })[0]);
    await waitFor(() => expect(onMarkViewed).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getAllByRole("button", { name: "Tap to view once" })[0]);
    expect(onMarkViewed).toHaveBeenCalledTimes(1);
    expect(resolveDumpItemMediaUrl).not.toHaveBeenCalled();
    expect(claimMedia).toHaveBeenCalledTimes(1);
    expect(loadMedia).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "true");
    expectNoPrivatePhotosLoaded();
    await act(async () => acknowledge(true));
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "false");
  });

  it("positions pending feedback above the full-screen media layers", async () => {
    let acknowledge;
    const onMarkViewed = vi.fn(() => new Promise((resolve) => { acknowledge = resolve; }));
    renderViewer(oncePost, { onMarkViewed });
    fireEvent.click(screen.getAllByRole("button", { name: "Tap to view once" })[0]);
    await waitFor(() => expect(onMarkViewed).toHaveBeenCalledTimes(1));
    try {
      expect(screen.getByRole("status").closest(".viewer-media-layer")).toBeNull();
      expect(screen.getByRole("status")).toHaveStyle({ position: "absolute", zIndex: "40" });
    } finally {
      await act(async () => acknowledge(true));
    }
  });

  it("does not reveal another post when an old acknowledgement completes after navigation", async () => {
    let acknowledge;
    const onMarkViewed = vi.fn(() => new Promise((resolve) => { acknowledge = resolve; }));
    const { rerender } = renderViewer(oncePost, { onMarkViewed });
    fireEvent.click(screen.getAllByRole("button", { name: "Tap to view once" })[0]);
    await waitFor(() => expect(onMarkViewed).toHaveBeenCalledTimes(1));
    rerender(<Viewer post={{ ...oncePost, id: "next-post" }} currentUserId="me" onMarkViewed={onMarkViewed} />);
    await act(async () => acknowledge(true));
    expectNoPrivatePhotosLoaded();
    expect(screen.getAllByRole("button", { name: "Tap to view once" })).toHaveLength(2);
  });

  it("does not display media when delivery fails after a committed acknowledgement", async () => {
    loadMedia.mockRejectedValueOnce(new Error("Delivery interrupted"));
    const onMarkViewed = vi.fn().mockResolvedValue(true);
    renderViewer(oncePost, { onMarkViewed });
    fireEvent.click(screen.getAllByRole("button", { name: "Tap to view once" })[0]);
    await screen.findByRole("alert");
    expectNoPrivatePhotosLoaded();
    expect(onMarkViewed).toHaveBeenCalledWith("once-1", expect.objectContaining({ status: "claimed" }));
    expect(resolveDumpItemMediaUrl).not.toHaveBeenCalled();
  });

  it("does not render private image bytes until the view acknowledgement succeeds", async () => {
    let acknowledge;
    const onMarkViewed = vi.fn(() => new Promise((resolve) => { acknowledge = resolve; }));
    renderViewer(oncePost, { onMarkViewed });
    fireEvent.click(screen.getAllByRole("button", { name: "Tap to view once" })[0]);
    await waitFor(() => expect(onMarkViewed).toHaveBeenCalledTimes(1));
    try {
      expectNoPrivatePhotosLoaded();
    } finally {
      await act(async () => acknowledge(true));
    }
    expect(screen.getByRole("img", { name: "First private photo" })).toBeInTheDocument();
  });

  it("does not download private photos before reveal, including offscreen slides", () => {
    const onMarkViewed = vi.fn().mockResolvedValue(true);
    renderViewer(oncePost, { onMarkViewed });

    expectNoPrivatePhotosLoaded();
    expect(onMarkViewed).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Keep unavailable" })).toBeDisabled();
  });

  it("keeps the current reveal visible when the parent records the view", async () => {
    const onMarkViewed = vi.fn().mockResolvedValue(true);
    const { rerender } = renderViewer(oncePost, { onMarkViewed });

    fireEvent.click(screen.getAllByRole("button", { name: "Tap to view once" })[0]);
    await waitFor(() => expect(onMarkViewed).toHaveBeenCalledExactlyOnceWith("once-1", expect.objectContaining({ status: "claimed" })));
    rerender(<Viewer post={{ ...oncePost, viewed: true }} currentUserId="me" onMarkViewed={onMarkViewed} />);
    // A subsequent UI update must not consume the opening-time snapshot.
    fireEvent.click(screen.getByRole("button", { name: "Comments" }));

    expect(screen.getByRole("img", { name: "First private photo" })).toHaveStyle({ filter: "none" });
    expect(screen.queryByLabelText("Already viewed once")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tap to view once" })).not.toBeInTheDocument();
    expect(onMarkViewed).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Keep unavailable" })).toBeDisabled();
  });

  it("locks an already-viewed post on its first render", () => {
    const onMarkViewed = vi.fn().mockResolvedValue(true);
    renderViewer({ ...oncePost, viewed: true }, { onMarkViewed });

    expectNoPrivatePhotosLoaded();
    expect(screen.getAllByLabelText("Already viewed once")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Tap to view once" })).not.toBeInTheDocument();
    expect(onMarkViewed).not.toHaveBeenCalled();
  });

  it("locks a consumed post when the viewer is closed and reopened", async () => {
    const onMarkViewed = vi.fn().mockResolvedValue(true);
    const { unmount } = renderViewer(oncePost, { onMarkViewed });
    fireEvent.click(screen.getAllByRole("button", { name: "Tap to view once" })[0]);
    await waitFor(() => expect(onMarkViewed).toHaveBeenCalledTimes(1));
    unmount();

    renderViewer({ ...oncePost, viewed: true }, { onMarkViewed });
    expectNoPrivatePhotosLoaded();
    expect(screen.queryByRole("button", { name: "Tap to view once" })).not.toBeInTheDocument();
    expect(onMarkViewed).toHaveBeenCalledTimes(1);
  });

  it("resets reveal and slide position when switching to another unviewed post", async () => {
    const onMarkViewed = vi.fn().mockResolvedValue(true);
    const { rerender } = renderViewer(oncePost, { onMarkViewed });
    fireEvent.click(screen.getAllByRole("button", { name: "Tap to view once" })[0]);
    await waitFor(() => expect(onMarkViewed).toHaveBeenCalledTimes(1));
    fireEvent.keyDown(screen.getByRole("group", { name: "Photo viewer" }), { key: "ArrowRight" });
    expect(screen.getByText("2/2")).toBeInTheDocument();

    rerender(<Viewer post={{ ...oncePost, id: "once-2" }} currentUserId="me" onMarkViewed={onMarkViewed} />);
    expectNoPrivatePhotosLoaded();
    expect(screen.getByText("1/2")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Tap to view once" })[0]);
    await waitFor(() => expect(onMarkViewed).toHaveBeenLastCalledWith("once-2", expect.objectContaining({ dump_id: "once-2" })));
    expect(onMarkViewed).toHaveBeenCalledTimes(2);
  });

  it("locks when switching from a revealed post to an already-viewed post", async () => {
    const { rerender } = renderViewer();
    fireEvent.click(screen.getAllByRole("button", { name: "Tap to view once" })[0]);
    await waitFor(() => expect(screen.getByRole("img", { name: "First private photo" })).toBeInTheDocument());
    rerender(<Viewer post={{ ...oncePost, id: "once-consumed", viewed: true }} currentUserId="me" />);

    expectNoPrivatePhotosLoaded();
    expect(screen.queryByRole("button", { name: "Tap to view once" })).not.toBeInTheDocument();
  });

  it("locks a post consumed elsewhere before this session reveals it", () => {
    const onMarkViewed = vi.fn();
    const { rerender } = renderViewer(oncePost, { onMarkViewed });
    rerender(<Viewer post={{ ...oncePost, viewed: true }} currentUserId="me" onMarkViewed={onMarkViewed} />);

    expectNoPrivatePhotosLoaded();
    expect(screen.queryByRole("button", { name: "Tap to view once" })).not.toBeInTheDocument();
    expect(onMarkViewed).not.toHaveBeenCalled();
  });

  it("never commits an unblurred frame while switching to a consumed post", () => {
    const frames = [];
    function FrameProbe({ post }) {
      React.useLayoutEffect(() => {
        frames.push(Array.from(document.querySelectorAll(".post-media img"), (image) => image.style.filter));
      });
      return <Viewer post={post} currentUserId="me" />;
    }
    const { rerender } = render(<FrameProbe post={{ ...oncePost, mode: "24h" }} />);
    frames.length = 0;
    rerender(<FrameProbe post={{ ...oncePost, viewed: true }} />);

    expect(frames.length).toBeGreaterThan(0);
    for (const frame of frames) {
      expect(frame).toEqual([]);
    }
  });

  it("does not unlock an opening-time lock when parent data becomes stale", () => {
    const { rerender } = renderViewer({ ...oncePost, viewed: true });
    rerender(<Viewer post={oncePost} currentUserId="me" />);

    expectNoPrivatePhotosLoaded();
    expect(screen.queryByRole("button", { name: "Tap to view once" })).not.toBeInTheDocument();
  });

  it("does not blur ordinary posts or disable their Keep action", () => {
    renderViewer({ ...oncePost, mode: "24h", allowOthersToKeep: true, postedMinutesAgo: 1 });
    for (const image of screen.queryAllByRole("img")) {
      expect(image).toHaveStyle({ filter: "none" });
    }
    expect(screen.getByRole("button", { name: "Keep" })).toBeEnabled();
  });
});
