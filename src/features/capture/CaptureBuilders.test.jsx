// @vitest-environment jsdom

import React from "react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DumpBuilder, RollBuilder } from "./CaptureBuilders.jsx";

vi.mock("./mediaUpload.js", () => ({
  MAX_MEDIA_COUNT: 20,
  validateMediaFile: vi.fn(),
  validateMediaFiles: (files) => files,
}));

vi.mock("../rollPresentation.js", () => ({
  ROLL_STAGES: ["loading", "winding", "developing", "revealing", "finished"],
  getNextRollStage: (stage) => {
    const stages = ["loading", "winding", "developing", "revealing", "finished"];
    return stages[Math.min(stages.indexOf(stage) + 1, stages.length - 1)];
  },
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

    render(<DumpBuilder activeSpaceId="main" onCancel={() => {}} onPost={onPost} />);

    const input = screen.getByLabelText("Choose photos").querySelector("input");
    fireEvent.change(input, { target: { files: [makeFile()] } });

    const postButton = screen.getByRole("button", { name: "Post dump" });
    fireEvent.click(postButton);

    expect(postButton).toBeDisabled();
    expect(postButton).toHaveTextContent("Uploading…");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(onPost).toHaveBeenCalledTimes(1);

    rejectPost(new Error("Upload failed"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Upload failed");
      expect(screen.getByRole("button", { name: "Post dump" })).toBeEnabled();
    });
  });
});

describe("RollBuilder publishing", () => {
  it("locks the publishing controls while the roll is being posted", async () => {
    let resolvePost;
    const onPost = vi.fn(() => new Promise((resolve) => {
      resolvePost = resolve;
    }));

    render(<RollBuilder activeSpaceId="main" onCancel={() => {}} onPost={onPost} />);

    fireEvent.click(screen.getByRole("button", { name: "Start roll" }));
    const captureInput = screen.getByDisplayValue("")?.closest?.("input");
    expect(captureInput).not.toBeNull();

    for (let index = 0; index < 8; index += 1) {
      fireEvent.change(captureInput, { target: { files: [makeFile(`frame-${index + 1}.jpg`)] } });
    }

    fireEvent.click(screen.getByRole("button", { name: "Develop roll" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Developing…" })).toBeInTheDocument());

    await waitFor(() => expect(screen.getByText("Ready to post")).toBeInTheDocument(), { timeout: 6000 });

    fireEvent.click(screen.getByRole("button", { name: "Post roll" }));

    expect(screen.getByRole("button", { name: "Uploading…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(onPost).toHaveBeenCalledTimes(1);

    resolvePost();
  });
});
