import { describe, expect, it } from "vitest";
import { getPinnedBoards } from "./boardPinning.js";

describe("Profile pinned Boards", () => {
  it("returns only pinned Boards and caps the profile preview at three", () => {
    const boards = [
      { id: "a", pinned: true },
      { id: "b", pinned: false },
      { id: "c", pinned: true },
      { id: "d", pinned: true },
      { id: "e", pinned: true },
    ];

    expect(getPinnedBoards(boards).map((board) => board.id)).toEqual([
      "a",
      "c",
      "d",
    ]);
  });
});
