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
  default: ({ onSelect, onClose }) => (
    <div role="dialog" aria-label="Choose a GIF">
      <button
        type="button"
        data-testid="mock-gif-select"
        onClick={() => onSelect({
          id: "gif-1",
          mediaType: "gif",
          mediaUrl: "https://giphy.test/reaction.gif",
          title: "Reaction",
        })}
      >
        Select GIF
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

describe("Viewer GIF composer", () => {
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

  it("opens the GIF picker from the comment composer", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Choose GIF" }));
    expect(screen.getByRole("dialog", { name: "Choose a GIF" })).toBeInTheDocument();
  });

  it("sends a selected GIF through the existing comment callback", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Choose GIF" }));
    fireEvent.click(screen.getByTestId("mock-gif-select"));

    expect(onComment).toHaveBeenCalledWith("post-1", {
      media_type: "gif",
      media_url: "https://giphy.test/reaction.gif",
      media_metadata: expect.objectContaining({
        id: "gif-1",
      }),
    });
  });
});
