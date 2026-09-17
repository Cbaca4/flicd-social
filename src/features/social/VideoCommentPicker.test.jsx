// @vitest-environment jsdom

import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import VideoCommentPicker from "./VideoCommentPicker.jsx";

afterEach(() => cleanup());

describe("VideoCommentPicker", () => {
  it("offers separate camera and device video entry points", () => {
    render(<VideoCommentPicker onSelect={() => {}} onClose={() => {}} />);

    expect(screen.getByLabelText("Record a video", { selector: "input" }))
      .toHaveAttribute("capture", "user");
    expect(screen.getByLabelText("Choose a video from device", { selector: "input" }))
      .toHaveAttribute("accept", "video/mp4,video/webm");
  });

  it("previews a valid video before the composer receives it", async () => {
    const onSelect = vi.fn();
    const file = new File(["video"], "clip.mp4", { type: "video/mp4" });
    const createObjectUrl = vi.fn().mockReturnValue("blob:preview");
    const revokeObjectUrl = vi.fn();

    render(
      <VideoCommentPicker
        onSelect={onSelect}
        onClose={() => {}}
        getVideoDuration={vi.fn().mockResolvedValue(12)}
        createObjectUrl={createObjectUrl}
        revokeObjectUrl={revokeObjectUrl}
      />,
    );

    fireEvent.change(screen.getByLabelText("Choose a video from device", { selector: "input" }), {
      target: { files: [file] },
    });

    expect(await screen.findByLabelText("Video preview")).toHaveAttribute("src", "blob:preview");
    expect(screen.getByText("12.0s")).toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Use video" }));

    expect(onSelect).toHaveBeenCalledWith({
      mediaType: "video",
      mediaBlob: file,
      mediaMetadata: {
        duration_seconds: 12,
      },
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

    fireEvent.change(screen.getByLabelText("Choose a video from device", { selector: "input" }), {
      target: { files: [file] },
    });

    expect(
      await screen.findByText(/15 seconds or shorter/i),
    ).toBeInTheDocument();

    expect(onSelect).not.toHaveBeenCalled();
  });
});
