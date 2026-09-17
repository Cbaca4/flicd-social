// @vitest-environment jsdom

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import PeopleDiscovery from "./PeopleDiscovery.jsx";

const getPeopleSuggestions = vi.hoisted(() => vi.fn());

vi.mock("../social/socialApi.js", () => ({
  getPeopleSuggestions,
}));

vi.mock("../social/FollowButton.jsx", () => ({
  default: () => <button type="button">Follow</button>,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PeopleDiscovery profile navigation", () => {
  it("opens a suggested user's public profile", async () => {
    const onUserSelect = vi.fn();
    getPeopleSuggestions.mockResolvedValue([
      {
        id: "person-1",
        username: "maren_",
        display_name: "Maren",
        bio: "moments + coffee",
        interests: ["Coffee"],
        sharedInterests: [],
      },
    ]);

    render(<PeopleDiscovery onUserSelect={onUserSelect} />);

    fireEvent.click(await screen.findByRole("button", { name: "Open profile @maren_" }));
    expect(onUserSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "person-1", username: "maren_" }));
  });
});
