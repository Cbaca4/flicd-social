// @vitest-environment jsdom

import React from "react";
import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DumpBuilder, RollBuilder } from "./CaptureBuilders.jsx";

vi.mock("./mediaUpload.js", () => ({
  MAX_MEDIA_COUNT: 20,
  validateMediaFile: vi.fn(),
  validateMediaFiles: (files) => files,
}));

vi.mock("./rollPresentation.js", () => ({
  ROLL_STAGES: ["loading", "finished"],
  getNextRollStage: () => "finished",
}));

function makeFile(name = "moment.jpg") {
  return new File([new Uint8Array([1, 2, 3])], name, { type: "image/jpeg" });
}

describe("DumpBuilder publishing", () => {
  it("locks the post controls while publishing and restores them after a failure", async () => {
    let rejectPost;
    const onPost = vi.fn(() => new Promise((_, reject) => {
      rejectPost = reject;
    }));

    const { container } = render(<DumpBuilder activeSpaceId="main" onCancel={() => {}} onPost={onPost} />);

    const input = screen.getByText("Choose photos").parentElement.querySelector("input");
    fireEvent.change(input, { target: { files: [makeFile()] } });

    const postButton = screen.getByRole("button", { name: "Post dump" });
    fireEvent.click(postButton);

    expect(postButton).toBeDisabled();
    expect(postButton).toHaveTextContent("Uploading…");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(onPost).toHaveBeenCalledTimes(1);
    expect(container.querySelector('input[type="file"][multiple]')).toBeInTheDocument();

    rejectPost(new Error("Upload failed"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Upload failed");
      expect(screen.getByRole("button", { name: "Post dump" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    });
  });
});

describe("RollBuilder publishing", () => {
  it("locks the publishing controls while the roll is being posted", async () => {
    vi.useFakeTimers();
    try {
      let resolvePost;
      const onPost = vi.fn(() => new Promise((resolve) => {
        resolvePost = resolve;
      }));

      const { container } = render(<RollBuilder activeSpaceId="main" onCancel={() => {}} onPost={onPost} />);
      const rollScreen = within(container);

      await act(async () => {
        fireEvent.click(rollScreen.getByRole("button", { name: "Start roll" }));
      });

      const captureInput = container.querySelector('input[type="file"][capture="environment"]');
      expect(captureInput).toBeInTheDocument();

      for (let index = 0; index < 8; index += 1) {
        await act(async () => {
          fireEvent.change(captureInput, { target: { files: [makeFile(`frame-${index + 1}.jpg`)] } });
        });
      }

      expect(rollScreen.getByRole("button", { name: "Develop roll" })).toBeEnabled();

      await act(async () => {
        fireEvent.click(rollScreen.getByRole("button", { name: "Develop roll" }));
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      expect(rollScreen.getByText("Ready to post")).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(rollScreen.getByRole("button", { name: "Post roll" }));
      });

      expect(rollScreen.getByRole("button", { name: "Uploading…" })).toBeDisabled();
      expect(rollScreen.getByRole("button", { name: "Cancel" })).toBeDisabled();
      expect(onPost).toHaveBeenCalledTimes(1);

      resolvePost();
      await act(async () => {});
    } finally {
      vi.useRealTimers();
    }
  });
});
