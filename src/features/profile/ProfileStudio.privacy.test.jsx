// @vitest-environment jsdom

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProfileStudio from "./ProfileStudio.jsx";
import { DEFAULT_THEME } from "./profileTheme.js";

const { getCurrentProfile, setPrivateAccount, signOut } = vi.hoisted(() => ({
  getCurrentProfile: vi.fn(),
  setPrivateAccount: vi.fn(),
  signOut: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock("../social/socialApi.js", () => ({ getCurrentProfile, setPrivateAccount }));
vi.mock("../../lib/supabase", () => ({ supabase: { auth: { signOut } } }));

describe("Profile Studio privacy", () => {
  it("toggles between public and private account", async () => {
    getCurrentProfile.mockResolvedValue({ is_private: false });
    setPrivateAccount.mockResolvedValue(true);

    render(<ProfileStudio theme={DEFAULT_THEME} setTheme={() => {}} onClose={() => {}} onSave={() => {}} profile={{ handle: "you" }} />);

    const button = await screen.findByRole("button", { name: "Public" });
    fireEvent.click(button);

    await waitFor(() => expect(setPrivateAccount).toHaveBeenCalledWith(true));
    expect(await screen.findByRole("button", { name: "Private" })).toBeTruthy();
  });
});
