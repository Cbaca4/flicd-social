// @vitest-environment jsdom

import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Home, { Viewer } from "./Home.jsx";

vi.mock("../seasonal/SeasonalOverlay.jsx", () => ({
  default: () => null,
}));
vi.mock("./UserSearch.jsx", () => ({
  default: () => null,
}));
vi.mock("../profile/PublicProfile.jsx", () => ({
  default: () => null,
}));

afterEach(() => {
  cleanup();
});

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

describe("Post viewer", () => {
  const post = {
    id: "post-1",
    author: "baco",
    mood: "late night",
    mode: "dump",
    postedMinutesAgo: 20,
    liked: false,
    likes: 4,
    comments: [{ id: "comment-1", from: "mia", text: "love this" }],
    items: [{ id: "item-1", note: "one moment" }],
  };

  it("keeps actions and comments in separate viewer sections", () => {
    const onLike = vi.fn();
    const onComment = vi.fn();
    const onKeep = vi.fn();

    const { container } = render(
      <Viewer
        post={post}
        onClose={() => {}}
        onLike={onLike}
        onComment={onComment}
        onKeep={onKeep}
        onMarkViewed={() => {}}
      />,
    );

    const actions = container.querySelector(".post-actions");
    const conversation = container.querySelector(".post-conversation");
    const composer = container.querySelector(".comment-composer");

    expect(actions).toBeInTheDocument();
    expect(conversation).toBeInTheDocument();
    expect(conversation?.querySelector(".comment-composer")).toBe(composer);
    expect(screen.getByText("love this")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Add a comment")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Like" }));
    expect(onLike).toHaveBeenCalledWith("post-1");
  });

  it("disables only the like action while a like request is pending", () => {
    render(
      <Viewer
        post={post}
        onClose={() => {}}
        onLike={() => {}}
        onComment={() => {}}
        onKeep={() => {}}
        onMarkViewed={() => {}}
        likePending
      />,
    );

    expect(screen.getByRole("button", { name: "Like" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Keep" })).toBeEnabled();
    expect(screen.getByPlaceholderText("Add a comment")).toBeEnabled();
  });
});
