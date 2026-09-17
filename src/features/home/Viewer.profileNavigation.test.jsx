// @vitest-environment jsdom

import React from "react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Viewer } from "./Home.jsx";

describe("Viewer profile navigation", () => {
  it("makes another user's comment author openable as a public profile", () => {
    render(
      <Viewer
        post={{
          id: "post-1",
          author: "friend-id",
          mood: "night",
          mode: "dump",
          postedMinutesAgo: 20,
          liked: false,
          likes: 1,
          comments: [{ id: "comment-1", user_id: "friend-id", from: "mia", text: "hello" }],
          items: [{ id: "item-1", note: "moment" }],
        }}
        currentUserId="me"
        onUserSelect={() => {}}
        onClose={() => {}}
        onLike={() => {}}
        onComment={() => {}}
        onKeep={() => {}}
        onMarkViewed={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: "Open profile @mia" })).toBeInTheDocument();
  });
});
