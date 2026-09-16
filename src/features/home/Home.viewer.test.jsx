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

    expect(screen.getByRole("img", { name: /rooftop/i })).toHaveAttribute(
      "src",
      "https://cdn.example.com/user-1/rooftop.jpg"
    );
  });
});
