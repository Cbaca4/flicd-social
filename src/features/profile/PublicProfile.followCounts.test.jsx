// @vitest-environment jsdom

import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const getRelationshipCounts = vi.hoisted(() => vi.fn());
const getPublicProfile = vi.hoisted(() => vi.fn());
vi.mock("../social/socialApi.js", () => ({ getRelationshipCounts, getPublicProfile }));

vi.mock("../social/FollowButton.jsx", () => ({
  default: ({ onChange }) => (
    <button type="button" onClick={() => onChange?.("accepted")}>
      Follow user
    </button>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PublicProfile relationship counts", () => {
  it("increments followers when a follow becomes accepted", () => {
    getRelationshipCounts.mockResolvedValue({ followers: 4, following: 2 });
    getPublicProfile.mockResolvedValue(null);

    render(
      <PublicProfile
        profile={{
          id: "person-1",
          username: "maren_",
          display_name: "Maren",
          followers: 4,
          following: 2,
          profile_theme: null,
        }}
        onBack={() => {}}
      />,
    );

    expect(screen.getByText("4")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Follow user" }));
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("hydrates an ID-only profile into the user's actual public profile", async () => {
    getRelationshipCounts.mockResolvedValue({ followers: 2, following: 3 });
    getPublicProfile.mockResolvedValue({
      id: "person-2",
      username: "maren_",
      display_name: "Maren",
      bio: "moments + coffee",
      avatar_url: "",
      profile_theme: null,
    });

    render(<PublicProfile profile={{ id: "person-2" }} onBack={() => {}} />);

    expect(await screen.findByRole("heading", { level: 1, name: "@maren_" })).toBeInTheDocument();
    expect(screen.getByText("moments + coffee")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(getPublicProfile).toHaveBeenCalledWith("person-2");
  });
});
