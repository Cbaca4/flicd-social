// @vitest-environment jsdom

import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import GifPicker from "./GifPicker.jsx";
import { getTrendingGifs, searchGifs } from "./giphyApi.js";

vi.mock("./giphyApi.js", () => ({
  getTrendingGifs: vi.fn(),
  searchGifs: vi.fn(),
  GIPHY_ATTRIBUTION_TEXT: "Powered By GIPHY",
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("GifPicker", () => {
  const gifs = [
    {
      id: "1",
      title: "wave",
      previewUrl: "https://giphy.test/wave-preview.gif",
      fullUrl: "https://giphy.test/wave.gif",
      width: 200,
      height: 150,
    },
  ];

  it("loads trending GIFs when opened", async () => {
    getTrendingGifs.mockResolvedValueOnce(gifs);

    render(<GifPicker onSelect={() => {}} onClose={() => {}} />);

    expect(await screen.findByTestId("giphy-result-1")).toBeInTheDocument();
    expect(screen.getByText("Powered By GIPHY")).toBeInTheDocument();
    expect(getTrendingGifs).toHaveBeenCalledTimes(1);
  });

  it("searches after entering a query", async () => {
    getTrendingGifs.mockResolvedValueOnce([]);
    searchGifs.mockResolvedValueOnce(gifs);

    render(<GifPicker onSelect={() => {}} onClose={() => {}} />);

    const searchbox = await screen.findByRole("searchbox", { name: /search gifs/i });
    fireEvent.change(searchbox, { target: { value: "cats" } });
    fireEvent.keyDown(searchbox, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(searchGifs).toHaveBeenCalledWith("cats", expect.any(Object));
    });
    expect(await screen.findByTestId("giphy-result-1")).toBeInTheDocument();
  });

  it("passes a selected GIF to the composer", async () => {
    getTrendingGifs.mockResolvedValueOnce(gifs);
    const onSelect = vi.fn();

    render(<GifPicker onSelect={onSelect} onClose={() => {}} />);

    fireEvent.click(await screen.findByTestId("giphy-result-1"));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
      id: "1",
      mediaType: "gif",
      mediaUrl: "https://giphy.test/wave.gif",
    }));
  });
});
