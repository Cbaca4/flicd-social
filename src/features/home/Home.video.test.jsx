// @vitest-environment jsdom

import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Viewer } from "./Home.jsx";

vi.mock("../seasonal/SeasonalOverlay.jsx", () => ({ default: () => null }));
vi.mock("../social/voiceCommentRecorder.js", () => ({
  createVoiceCommentRecorder: () => ({
    start: vi.fn(),
    stop: vi.fn(),
    cancel: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    getBlob: vi.fn(() => null),
  }),
}));
vi.mock("../social/GifPicker.jsx", () => ({
  default: () => null,
}));
vi.mock("../social/VideoCommentPicker.jsx", () => ({
  default: ({ onSelect, onClose }) => (
    <div role="dialog" aria-label="Choose a video">
      <button
        type="button"
        data-testid="mock-video-select"
        onClick={() => onSelect({
          mediaType: "video",
          mediaBlob: new File(["video"], "clip.mp4", { type: "video/mp4" }),
          mediaMetadata: { duration_seconds: 12 },
        })}
      >
        Select video
      </button>
      <button type="button" onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn(async () => ({
          data: { signedUrl: "https://media.example.test/comment.webm" },
          error: null,
        })),
      })),
    },
  },
}));

afterEach(() => cleanup());

describe("Viewer video composer", () => {
  const post = {
    id: "post-1",
    author: "baco",
    mood: "late night",
    mode: "dump",
    postedMinutesAgo: 20,
    liked: false,
    likes: 4,
    comments: [],
    items: [{ id: "item-1", note: "one moment" }],
  };

  it("opens the video picker from the comment composer", () => {
    render(
      <Viewer
        post={post}
        onClose={() => {}}
        onLike={() => {}}
        onComment={() => {}}
        onKeep={() => {}}
        onMarkViewed={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose video" }));
    expect(screen.getByRole("dialog", { name: "Choose a video" })).toBeInTheDocument();
  });

  it("keeps a selected video as a pending attachment until Send", () => {
    const onComment = vi.fn().mockResolvedValue({ id: "video-comment-1" });

    render(
      <Viewer
        post={post}
        onClose={() => {}}
        onLike={() => {}}
        onComment={onComment}
        onKeep={() => {}}
        onMarkViewed={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose video" }));
    fireEvent.click(screen.getByTestId("mock-video-select"));

    expect(screen.getByLabelText("Pending video attachment")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send comment" })).toBeEnabled();
    expect(onComment).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Send comment" }));

    expect(onComment).toHaveBeenCalledWith("post-1", expect.objectContaining({
      media_type: "video",
      media_blob: expect.any(File),
      media_metadata: { duration_seconds: 12 },
    }));
  });

  it("removes a pending video without sending it", () => {
    const onComment = vi.fn();

    render(
      <Viewer
        post={post}
        onClose={() => {}}
        onLike={() => {}}
        onComment={onComment}
        onKeep={() => {}}
        onMarkViewed={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose video" }));
    fireEvent.click(screen.getByTestId("mock-video-select"));
    fireEvent.click(screen.getByRole("button", { name: "Remove attachment" }));

    expect(screen.queryByLabelText("Pending video attachment")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send comment" })).toBeDisabled();
    expect(onComment).not.toHaveBeenCalled();
  });
});