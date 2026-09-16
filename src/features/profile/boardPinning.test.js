import { describe, expect, it } from "vitest";
import {
  canPinBoard,
  countPinnedBoards,
  getPinnedBoards,
} from "./boardPinning.js";

describe("Board pinning", () => {
  it("allows pinning when fewer than three Boards are pinned", () => {
    const boards = [
      { id: "a", pinned: true },
      { id: "b", pinned: true },
      { id: "c", pinned: false },
    ];

    expect(countPinnedBoards(boards)).toBe(2);
    expect(canPinBoard(boards, "c")).toBe(true);
  });

  it("allows unpinning even when three Boards are already pinned", () => {
    const boards = [
      { id: "a", pinned: true },
      { id: "b", pinned: true },
      { id: "c", pinned: true },
    ];

    expect(canPinBoard(boards, "a")).toBe(true);
  });

  it("blocks pinning a fourth Board", () => {
    const boards = [
      { id: "a", pinned: true },
      { id: "b", pinned: true },
      { id: "c", pinned: true },
      { id: "d", pinned: false },
    ];

    expect(countPinnedBoards(boards)).toBe(3);
    expect(canPinBoard(boards, "d")).toBe(false);
  });

  it("returns only the first three pinned Boards for the profile", () => {
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
