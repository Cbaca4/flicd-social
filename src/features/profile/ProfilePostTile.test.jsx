/** @vitest-environment jsdom */
import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProfilePostTile from "./ProfilePostTile.jsx";

const { resolveDumpItemMediaUrl } = vi.hoisted(() => ({
  resolveDumpItemMediaUrl: vi.fn(),
}));

vi.mock("../home/mediaUrl.js", () => ({ resolveDumpItemMediaUrl }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ProfilePostTile media privacy", () => {
  it("never requests or mounts a view-once frame", () => {
    const onOpen = vi.fn();
    render(<ProfilePostTile
      post={{ id: "private-1", type: "dump", mode: "once", items: [{ imagePath: "secret/a.jpg", mediaBucket: "flicd-dump-private" }] }}
      onOpen={onOpen}
    />);
    expect(resolveDumpItemMediaUrl).not.toHaveBeenCalled();
    expect(document.querySelector(".profile-gallery-thumbnail")).not.toBeInTheDocument();
    expect(screen.getByText("View once")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open dump post" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("uses the regular media resolver for active 24-hour previews", async () => {
    resolveDumpItemMediaUrl.mockResolvedValueOnce("https://cdn.example/signed.jpg?token=temporary");
    render(<ProfilePostTile
      post={{ id: "regular-1", type: "roll", mode: "24h", items: [{ imagePath: "member/photo.jpg", mediaBucket: "flicd-dump-private" }] }}
    />);
    await waitFor(() => expect(screen.getByRole("img", { hidden: true })).toHaveAttribute("src", "https://cdn.example/signed.jpg?token=temporary"));
    expect(resolveDumpItemMediaUrl).toHaveBeenCalledWith({
      imagePath: "member/photo.jpg",
      mediaBucket: "flicd-dump-private",
      imageUrl: null,
    });
  });

  it("falls back to the decorative card when the media resolver denies access", async () => {
    resolveDumpItemMediaUrl.mockRejectedValueOnce(new Error("denied"));
    render(<ProfilePostTile
      post={{ id: "regular-2", type: "dump", mode: "24h", items: [{ imagePath: "member/denied.jpg", mediaBucket: "flicd-dump-private" }] }}
    />);
    await waitFor(() => expect(resolveDumpItemMediaUrl).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open dump post" })).toBeInTheDocument();
  });

  it("does not fetch a preview if no media is present", () => {
    render(<ProfilePostTile post={{ id: "empty", type: "dump", mode: "24h", items: [] }} />);
    expect(resolveDumpItemMediaUrl).not.toHaveBeenCalled();
    expect(screen.getByText("Dump")).toBeInTheDocument();
  });
});
