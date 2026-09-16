// @vitest-environment jsdom

import React from "react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Home from "./Home.jsx";

vi.mock("../seasonal/SeasonalOverlay.jsx", () => ({
  default: () => null,
}));
vi.mock("./UserSearch.jsx", () => ({
  default: () => null,
}));
vi.mock("../profile/PublicProfile.jsx", () => ({
  default: () => null,
}));

describe("Home feed states", () => {
  const activeSpace = {
    id: "main",
    handle: "baco",
    label: "Main",
    followers: 12,
  };

  it("renders loading skeletons while the feed is loading", () => {
    render(
      <Home
        dumps={[]}
        activeSpace={activeSpace}
        loading
        onOpen={() => {}}
      />,
    );

    expect(screen.getAllByTestId("feed-skeleton")).toHaveLength(3);
    expect(screen.queryByText("Nothing here yet")).not.toBeInTheDocument();
  });

  it("renders a retryable error instead of the empty state", () => {
    const onRetry = vi.fn();

    render(
      <Home
        dumps={[]}
        activeSpace={activeSpace}
        error="Failed to load social feed."
        onRetry={onRetry}
        onOpen={() => {}}
      />,
    );

    expect(screen.getByText("Could not load your feed")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong while loading your moments.")).toBeInTheDocument();
    expect(screen.queryByText("Nothing here yet")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("preserves the existing empty state when the feed is ready with no posts", () => {
    render(
      <Home
        dumps={[]}
        activeSpace={activeSpace}
        loading={false}
        error=""
        onOpen={() => {}}
      />,
    );

    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
  });
});
