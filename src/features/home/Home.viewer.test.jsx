// @vitest-environment jsdom

import React from "react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Viewer } from "./Home.jsx";

vi.mock("./mediaUrl.js", () => ({
  getDumpItemMediaUrl: (imagePath) => imagePath ? `https://cdn.example.com/${imagePath}` : null,
}));

describe("Viewer", () => {
  afterEach(() => cleanup());
  it("renders its context even when no viewed callback is provided", () => {
    const post = {
      id: 1,
      author: "maren_",
      mood: "golden hour",
      mode: "24h",
      postedMinutesAgo: 45,
      likes: 12,
      liked: false,
      items: [{ note: "rooftop, 7pm" }],
      comments: [],
    };

    render(
      <Viewer
        post={post}
        onClose={() => {}}
        onLike={() => {}}
        onComment={() => {}}
        onKeep={() => {}}
      />
    );

    expect(screen.getByText("rooftop, 7pm")).toBeTruthy();
    expect(screen.getByRole("button", { name: /keep/i })).toBeTruthy();
  });

  it("reveals a view-once photo and records the view", () => {
    const onMarkViewed = vi.fn();
    const post = {
      id: "once-1",
      author: "maren_",
      mood: "golden hour",
      mode: "once",
      postedMinutesAgo: 1,
      likes: 0,
      liked: false,
      viewed: false,
      items: [{ note: "private moment", imagePath: "user-1/private.jpg" }],
      comments: [],
    };

    render(
      <Viewer
        post={post}
        onClose={() => {}}
        onLike={() => {}}
        onComment={() => {}}
        onKeep={() => {}}
        onMarkViewed={onMarkViewed}
      />,
    );

    expect(screen.getByRole("button", { name: "Tap to view once" })).toBeInTheDocument();
    screen.getByRole("button", { name: "Tap to view once" }).click();

    expect(onMarkViewed).toHaveBeenCalledWith("once-1");
    expect(screen.getByRole("img", { name: /private moment/i })).toHaveAttribute(
      "src",
      "https://cdn.example.com/user-1/private.jpg",
    );
  });

  it("renders stored media when a dump item has an image path", () => {
    const post = {
      id: 2,
      author: "maren_",
      mood: "golden hour",
      mode: "24h",
      postedMinutesAgo: 10,
      likes: 4,
      liked: false,
      items: [{
        note: "rooftop",
        imagePath: "user-1/rooftop.jpg",
      }],
      comments: [],
    };

    render(
      <Viewer
        post={post}
        onClose={() => {}}
        onLike={() => {}}
        onComment={() => {}}
        onKeep={() => {}}
      />
    );

    const image = screen.getByRole("img", { name: /rooftop/i });

expect(image.getAttribute("src")).toBe(
  "https://cdn.example.com/user-1/rooftop.jpg"
);
  });

  it("switches to the next photo with a horizontal swipe", () => {
    const swipePost = {
      id: "swipe-1",
      author: "baco",
      mood: "late night",
      mode: "dump",
      postedMinutesAgo: 5,
      likes: 2,
      liked: false,
      comments: [],
      items: [
        { id: "frame-1", note: "first frame" },
        { id: "frame-2", note: "second frame" },
      ],
    };

    render(
      <Viewer
        post={swipePost}
        currentUserId="me"
        onClose={() => {}}
        onLike={() => {}}
        onComment={() => {}}
        onKeep={() => {}}
        onMarkViewed={() => {}}
      />
    );

    const viewport = screen.getByRole("group", { name: "Photo viewer" });

    fireEvent.pointerDown(viewport, { pointerId: 1, clientX: 300, clientY: 200, button: 0, isPrimary: true });
    fireEvent.pointerMove(viewport, { pointerId: 1, clientX: 100, clientY: 204, isPrimary: true });
    fireEvent.pointerUp(viewport, { pointerId: 1, clientX: 100, clientY: 204, isPrimary: true });

    expect(screen.getByText("2/2")).toBeInTheDocument();
  });

  it("collapses multiple comments behind Open comments until requested", () => {
    const manyCommentsPost = {
      id: "comments-2",
      author: "baco",
      mood: "late night",
      mode: "dump",
      postedMinutesAgo: 5,
      likes: 2,
      liked: false,
      comments: [
        { id: "comment-a", user_id: "friend-a", from: "mia", text: "first comment" },
        { id: "comment-b", user_id: "friend-b", from: "alex", text: "second comment" },
      ],
      items: [{ id: "frame-1", note: "one frame" }],
    };

    render(
      <Viewer
        post={manyCommentsPost}
        currentUserId="me"
        onClose={() => {}}
        onLike={() => {}}
        onComment={() => {}}
        onKeep={() => {}}
        onMarkViewed={() => {}}
      />
    );

    expect(screen.getByRole("button", { name: /open comments/i })).toBeInTheDocument();
    expect(screen.queryByText("first comment")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /open comments/i }));

    expect(screen.getByText("first comment")).toBeInTheDocument();
    expect(screen.getByText("second comment")).toBeInTheDocument();
  });

});
