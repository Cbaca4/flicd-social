/** @vitest-environment jsdom */
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import PublicProfile from "./PublicProfile.jsx";

describe("PublicProfile", () => {
  it("renders a read-only public profile and returns on back", () => {
    const onBack = vi.fn();

    render(
      <PublicProfile
        profile={{
          username: "maren_",
          display_name: "Maren",
          bio: "moments + coffee",
          avatar_url: "",
          followers: 42,
          following: 18,
          profile_theme: {
            background: "#181a20",
            accent: "#ff72b6",
            message: "collecting little things",
            statusEmoji: "✦",
            status: "making memories",
          },
        }}
        onBack={onBack}
      />
    );

    const usernameHeadings = screen.getAllByRole("heading", { name: "@maren_" });
    expect(usernameHeadings.length).toBe(2);
    expect(screen.getByText("Maren")).toBeTruthy();
    expect(screen.getByText("moments + coffee")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByText("18")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Follow user/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Edit Profile/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Customize/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
