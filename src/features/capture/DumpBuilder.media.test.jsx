// @vitest-environment jsdom

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DumpBuilder } from "./CaptureBuilders.jsx";

vi.mock("./mediaUpload.js", () => ({
  MAX_MEDIA_COUNT: 20,
  validateMediaFile: (file) => file,
  validateMediaFiles: (files) => {
    if (files.length > 20) throw new Error("You can add up to 20 images.");
    return files;
  },
}));

vi.mock("./rollPresentation.js", () => ({
  ROLL_STAGES: ["loading", "winding", "developing", "revealing", "finished"],
  getNextRollStage: (stage) => stage === "finished" ? "finished" : "finished",
}));

describe("DumpBuilder media inputs", () => {
  const props = {
    spaces: [{ id: "main", handle: "you" }],
    activeSpaceId: "main",
    onCancel: vi.fn(),
    onPost: vi.fn(),
  };

  it("provides separate camera and gallery inputs", () => {
    const { container } = render(<DumpBuilder {...props} />);
    const inputs = Array.from(container.querySelectorAll('input[type="file"]'));
    const cameraInput = inputs.find((input) => !input.hasAttribute("multiple"));
    const galleryInput = inputs.find((input) => input.hasAttribute("multiple"));

    expect(inputs).toHaveLength(2);
    expect(cameraInput).toBeTruthy();
    expect(cameraInput?.getAttribute("accept")).toBe("image/jpeg,image/png,image/webp");
    expect(galleryInput).toBeTruthy();
    expect(galleryInput?.getAttribute("accept")).toBe("image/jpeg,image/png,image/webp");
    expect(screen.getByRole("button", { name: "Take photo" })).toBeTruthy();
    expect(screen.getByText("Choose photos")).toBeTruthy();
  });

  it("keeps camera and gallery selections in the same dump", () => {
    const { container } = render(<DumpBuilder {...props} />);
    const inputs = Array.from(container.querySelectorAll('input[type="file"]'));
    const cameraInput = inputs.find((input) => !input.hasAttribute("multiple"));
    const galleryInput = inputs.find((input) => input.hasAttribute("multiple"));
    const cameraFile = new File(["camera"], "camera.jpg", { type: "image/jpeg" });
    const galleryFile = new File(["gallery"], "gallery.jpg", { type: "image/jpeg" });

    fireEvent.change(cameraInput, { target: { files: [cameraFile] } });
    fireEvent.change(galleryInput, { target: { files: [galleryFile] } });

    expect(screen.getByText("2 photos selected")).toBeTruthy();
    expect(screen.getByText("camera.jpg")).toBeTruthy();
    expect(screen.getByText("gallery.jpg")).toBeTruthy();
  });
});
