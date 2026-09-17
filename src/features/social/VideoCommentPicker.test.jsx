// @vitest-environment jsdom

import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import VideoCommentPicker from "./VideoCommentPicker.jsx";

afterEach(() => cleanup());

describe("VideoCommentPicker", () => {
  it("passes a valid video to the composer with duration metadata", async () => {
    const onSelect = vi.fn();
    const file = new File(["video"], "clip.mp4", { type: "video/mp4" });

    render(
      <VideoCommentPicker
        onSelect={onSelect}
        onClose={() => {}}
        getVideoDuration={vi.fn().mockResolvedValue(12)}
      />,
    );

    fireEvent.change(screen.getByLabelText("Choose a video", { selector: "input" }), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith({
        mediaType: "video",
        mediaBlob: file,
        mediaMetadata: {
          duration_seconds: 12,
        },
      });
    });
  });

  it("rejects a video longer than 15 seconds", async () => {
    const onSelect = vi.fn();
    const file = new File(["video"], "too-long.mp4", { type: "video/mp4" });

    render(
      <VideoCommentPicker
        onSelect={onSelect}
        onClose={() => {}}
        getVideoDuration={vi.fn().mockResolvedValue(16)}
      />,
    );

    fireEvent.change(screen.getByLabelText("Choose a video", { selector: "input" }), {
      target: { files: [file] },
    });

    expect(
      await screen.findByText(/15 seconds or shorter/i),
    ).toBeInTheDocument();

    expect(onSelect).not.toHaveBeenCalled();
  });
});
