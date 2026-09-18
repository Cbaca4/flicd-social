// @vitest-environment jsdom

import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Explore from "./Explore.jsx";

const getExploreCandidates = vi.hoisted(() => vi.fn());

vi.mock("./discoverApi.js", () => ({
  getExploreCandidates,
}));

vi.mock("../home/mediaUrl.js", () => ({
  getDumpItemMediaUrl: vi.fn(() => null),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Explore mosaic", () => {
  it("renders a scored mosaic inside the existing Explore tab", async () => {
    getExploreCandidates.mockResolvedValue({
      candidates: [
        {
          id: "roll-1",
          authorId: "user-1",
          author: "bac",
          authorName: "Bac",
          type: "roll",
          mood: "music",
          context: "night drive",
          interests: ["Music"],
          items: [{ imagePath: "user-1/roll.jpg" }],
          likes: 8,
          comments: [],
          createdAt: new Date().toISOString(),
        },
        {
          id: "dump-1",
          authorId: "user-2",
          author: "maren_",
          authorName: "Maren",
          type: "dump",
          mood: "street",
          context: "street photography",
          interests: ["Photography"],
          items: [{ imagePath: "user-2/dump.jpg" }],
          likes: 2,
          comments: [],
          createdAt: new Date(Date.now() - 5000).toISOString(),
        },
      ],
      interests: ["Photography", "Music"],
      followingIds: new Set(["user-2"]),
    });

    const onOpenPost = vi.fn();
    render(<Explore onOpenPost={onOpenPost} />);

    expect(await screen.findByRole("region", { name: "Explore posts" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open @bac roll" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open @maren_ dump" })).toBeInTheDocument();
    expect(document.querySelector(".discover-grid")).toBeTruthy();
    expect(document.querySelectorAll(".discover-tile").length).toBe(2);

    fireEvent.click(screen.getByRole("button", { name: "Open @bac roll" }));
    await waitFor(() => expect(onOpenPost).toHaveBeenCalledWith(expect.objectContaining({ id: "roll-1" })));
  });
});
