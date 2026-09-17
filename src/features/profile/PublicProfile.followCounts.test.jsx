// @vitest-environment jsdom

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("../social/FollowButton.jsx", () => ({
  default: ({ onChange }) => (
    <button type="button" onClick={() => onChange?.("accepted")}>
      Follow user
    </button>
  ),
}));

import PublicProfile from "./PublicProfile.jsx";

describe("PublicProfile relationship counts", () => {
  it("increments followers when a follow becomes accepted", () => {
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
});
