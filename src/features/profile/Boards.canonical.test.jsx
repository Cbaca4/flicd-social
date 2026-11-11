/** @vitest-environment jsdom */
import React from "react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { renderAccount } from '../../../tests/security/renderAccount.jsx';
const render = (ui, options) => renderAccount(ui, 'me', options);
const { rows, api } = vi.hoisted(() => ({ rows: { current: [] }, api: { getBoards: vi.fn(), getBoardItems: vi.fn(), linkBoardItem: vi.fn(), deleteBoardItem: vi.fn(), removeKeep: vi.fn(), saveBoardItem: vi.fn(), createBoard: vi.fn(), deleteBoard: vi.fn(), updateBoard: vi.fn() } }));
vi.mock("./boardApi", () => api);
vi.mock("../home/mediaSessionApi.js", () => ({ mediaApi: { blob: async () => new Blob(["synthetic"]) } }));
import Boards from "./Boards.jsx";
const photo = (id, author, own = false) => ({ id, source_author_id: author, source_username: "same-current-name", is_own_photo: own, saved_note: id, note: id, board_ids: ["board-a", "board-b"], source_dump_id: "expired-post", dump_id: "expired-post", item_position: 7 });
beforeEach(() => {
  vi.clearAllMocks(); rows.current = [photo("mine", "me", true), photo("theirs-one", "uuid-one"), photo("theirs-two", "uuid-two")];
  api.getBoards.mockResolvedValue([{ id: "board-a", name: "Trips" }, { id: "board-b", name: "Ideas" }]);
  api.getBoardItems.mockImplementation(async (id) => id ? rows.current.filter(row => row.board_ids.includes(id)) : rows.current);
  URL.createObjectURL = vi.fn(() => "blob:synthetic"); URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);
it("separates My Photos from Kept from Others using server-derived ownership", async () => {
  render(<Boards />); fireEvent.click(await screen.findByRole("button", { name: "My Photos" }));
  expect(await screen.findByText("mine")).toBeInTheDocument(); expect(screen.queryByText("theirs-one")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Kept from Others" }));
  expect(await screen.findByText("theirs-one")).toBeInTheDocument(); expect(screen.queryByText("mine")).not.toBeInTheDocument();
  expect(screen.getAllByRole("heading", { name: "@same-current-name" })).toHaveLength(2);
});
it("links an existing expired Keep by canonical ID, without re-saving its source", async () => {
  render(<Boards initialBoardId="board-a" />); fireEvent.click(await screen.findByRole("button", { name: "Add saved items" }));
  // A photo already in the Board is not offered; an unorganized Keep is.
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  rows.current.push({ ...photo("unorganized", "uuid-three"), board_ids: [] });
  fireEvent.click(screen.getByRole("button", { name: "Back to Boards" }));
  fireEvent.click(screen.getByRole("button", { name: "Refresh Saves" }));
  await waitFor(() => expect(api.getBoardItems.mock.calls.length).toBeGreaterThan(2));
  fireEvent.click(await screen.findByRole("button", { name: "My Photos" }));
  fireEvent.click(screen.getByRole("button", { name: "Custom Boards" }));
  fireEvent.click(screen.getByRole("button", { name: /Trips.*Your saved moments/ }));
  fireEvent.click(await screen.findByRole("button", { name: "Add saved items" }));
  fireEvent.click(screen.getByRole("button", { name: /unorganized/ })); fireEvent.click(screen.getByRole("button", { name: "Add 1 item" }));
  await waitFor(() => expect(api.linkBoardItem).toHaveBeenCalledWith("unorganized", "board-a", expect.objectContaining({user:'me'}))); expect(api.saveBoardItem).not.toHaveBeenCalled();
});
it("unlinks only this Board membership and keeps the photo in the library", async () => {
  render(<Boards initialBoardId="board-a" />);
  const buttons = await screen.findAllByTitle("Remove item"); fireEvent.click(buttons[0]);
  await waitFor(() => expect(api.deleteBoardItem).toHaveBeenCalledWith("mine", "board-a", expect.objectContaining({user:'me'}))); expect(api.removeKeep).not.toHaveBeenCalled();
});
it("keeps library memberships current after unlinking, without discarding the photo", async () => {
  api.deleteBoardItem.mockImplementation(async (id, boardId) => { rows.current = rows.current.map(row => row.id === id ? { ...row, board_ids: row.board_ids.filter(value => value !== boardId) } : row); });
  render(<Boards initialBoardId="board-a" />); fireEvent.click((await screen.findAllByTitle("Remove item"))[0]);
  await waitFor(() => expect(api.deleteBoardItem).toHaveBeenCalled());
  fireEvent.click(screen.getByRole("button", { name: "Back to Boards" }));
  fireEvent.click(screen.getByRole("button", { name: "My Photos" }));
  expect(await screen.findByText("mine")).toBeInTheDocument(); expect(screen.getByText("1 Board memberships")).toBeInTheDocument();
});
it("keeps unverified legacy metadata visible without media or creator guessing", async () => {
  rows.current = [{ id: "legacy", legacy_status: "needs_review", saved_note: "Old memory", note: "Old memory", board_ids: ["board-a"] }];
  render(<Boards />); fireEvent.click(await screen.findByRole("button", { name: "Legacy Saves" }));
  expect(await screen.findByText("Old memory")).toBeInTheDocument(); expect(screen.getByText(/awaiting.*review/i)).toBeInTheDocument(); expect(screen.queryByRole("img")).not.toBeInTheDocument();
});
it("shows failure and retry instead of a misleading empty library", async () => {
  api.getBoardItems.mockRejectedValueOnce(new Error("offline")); render(<Boards />);
  expect(await screen.findByRole("alert")).toHaveTextContent("offline"); fireEvent.click(screen.getByRole("button", { name: "Refresh Saves" }));
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
});
