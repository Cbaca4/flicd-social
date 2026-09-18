// @vitest-environment jsdom

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Viewer } from "./Home.jsx";

vi.mock("./mediaUrl.js", () => ({
  getDumpItemMediaUrl: (imagePath) => imagePath ? `https://cdn.example.com/${imagePath}` : null,
}));

describe("Viewer", () => {
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
});
