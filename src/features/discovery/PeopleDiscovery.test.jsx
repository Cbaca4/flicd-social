// @vitest-environment jsdom

import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import PeopleDiscovery from "./PeopleDiscovery.jsx";

const getPeopleSuggestions = vi.hoisted(() => vi.fn());
const searchCalls = vi.hoisted(() => vi.fn());

vi.mock("../../lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: () => ({
        ilike: (column, pattern) => {
          searchCalls(column, pattern);
          return { limit: async () => ({
            data: [{ id: "person-1", username: "maren_", avatar_url: null }],
            error: null,
          }) };
        },
      }),
    })),
  },
}));

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
  it("keeps commas, operators and LIKE wildcards as literal search text", async () => {
    vi.useFakeTimers();
    try {
      getPeopleSuggestions.mockResolvedValue([]);
      render(<PeopleDiscovery />);
      await act(async () => { await Promise.resolve(); });
      fireEvent.change(screen.getByRole("textbox", { name: "Search people" }), {
        target: { value: "a,b%_(x)" },
      });
      await act(async () => { await vi.advanceTimersByTimeAsync(230); });
      expect(searchCalls).toHaveBeenCalledTimes(2);
      expect(searchCalls).toHaveBeenCalledWith("username", String.raw`%a,b\%\_(x)%`);
      expect(searchCalls).toHaveBeenCalledWith("display_name", String.raw`%a,b\%\_(x)%`);
      expect(screen.getAllByRole("button", { name: "Open profile @maren_" })).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });


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
