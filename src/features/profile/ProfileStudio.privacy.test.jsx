// @vitest-environment jsdom

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderAccount } from '../../../tests/security/renderAccount.jsx';
const render = (ui, options) => renderAccount(ui, 'me', options);
import ProfileStudio from "./ProfileStudio.jsx";
import { DEFAULT_THEME } from "./profileTheme.js";

const { getCurrentProfile, setPrivateAccount, getPendingFollowRequests, signOut } = vi.hoisted(() => ({
  getCurrentProfile: vi.fn(),
  setPrivateAccount: vi.fn(),
  getPendingFollowRequests: vi.fn().mockResolvedValue([]),
  signOut: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock("../social/socialApi.js", () => ({ getCurrentProfile, setPrivateAccount, getPendingFollowRequests }));
vi.mock("../../lib/supabase", () => ({ supabase: { auth: { signOut } } }));

describe("Profile Studio privacy", () => {
  it("toggles between public and private account", async () => {
    getCurrentProfile.mockResolvedValue({ is_private: false });
    setPrivateAccount.mockResolvedValue(true);

    render(<ProfileStudio theme={DEFAULT_THEME} setTheme={() => {}} onClose={() => {}} onSave={() => {}} profile={{ handle: "you" }} />);

    const button = await screen.findByRole("button", { name: "Public" });
    // The label is present before asynchronous privacy loading enables input.
    await waitFor(() => expect(button.disabled).toBe(false));
    fireEvent.click(button);

    await waitFor(() => expect(setPrivateAccount).toHaveBeenCalledWith(true, expect.objectContaining({ isCurrent: expect.any(Function) })));
    expect(setPrivateAccount.mock.calls[0][1].isCurrent()).toBe(true);
    expect(await screen.findByRole("button", { name: "Private" })).toBeTruthy();
  });
});
