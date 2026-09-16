// @vitest-environment jsdom

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ProfileStudio from "./ProfileStudio.jsx";
import { DEFAULT_THEME } from "./profileTheme.js";

const { signOut } = vi.hoisted(() => ({
  signOut: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      signOut,
    },
  },
}));

describe("Profile Studio account settings", () => {
  it("signs the current user out from the settings screen", () => {
    render(
      <ProfileStudio
        theme={DEFAULT_THEME}
        setTheme={() => {}}
        onClose={() => {}}
        onSave={() => {}}
        profile={{ handle: "you" }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));

    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
