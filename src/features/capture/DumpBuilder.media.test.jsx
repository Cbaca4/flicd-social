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
    const inputs = container.querySelectorAll('input[type="file"]');

    expect(inputs).toHaveLength(2);
    expect(inputs[0].getAttribute("accept")).toBe("image/jpeg,image/png,image/webp");
    expect(inputs[0].hasAttribute("capture")).toBe(true);
    expect(inputs[0].getAttribute("capture") || "").toMatch(/^environment$|^$/);
    expect(inputs[0].hasAttribute("multiple")).toBe(false);
    expect(inputs[1].getAttribute("accept")).toBe("image/jpeg,image/png,image/webp");
    expect(inputs[1].hasAttribute("multiple")).toBe(true);
    expect(screen.getByRole("button", { name: "Take photo" })).toBeTruthy();
    expect(screen.getByText("Choose photos")).toBeTruthy();
  });

  it("keeps camera and gallery selections in the same dump", () => {
    const { container } = render(<DumpBuilder {...props} />);
    const inputs = container.querySelectorAll('input[type="file"]');
    const cameraFile = new File(["camera"], "camera.jpg", { type: "image/jpeg" });
    const galleryFile = new File(["gallery"], "gallery.jpg", { type: "image/jpeg" });

    fireEvent.change(inputs[0], { target: { files: [cameraFile] } });
    fireEvent.change(inputs[1], { target: { files: [galleryFile] } });

    expect(screen.getByText("2 photos selected")).toBeTruthy();
    expect(screen.getByText("camera.jpg")).toBeTruthy();
    expect(screen.getByText("gallery.jpg")).toBeTruthy();
  });
});
