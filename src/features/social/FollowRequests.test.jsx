// @vitest-environment jsdom

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderAccount } from '../../../tests/security/renderAccount.jsx';
const render = (ui, options) => renderAccount(ui, 'me', options);
import FollowRequests from "./FollowRequests.jsx";

const { getPendingFollowRequests, approveFollowRequest, declineFollowRequest } = vi.hoisted(() => ({
  getPendingFollowRequests: vi.fn(),
  approveFollowRequest: vi.fn(),
  declineFollowRequest: vi.fn(),
}));

vi.mock("./socialApi.js", () => ({
  getPendingFollowRequests,
  approveFollowRequest,
  declineFollowRequest,
}));

describe("FollowRequests", () => {
  it("renders pending requests and lets the owner accept or decline", async () => {
    getPendingFollowRequests.mockResolvedValue([
      { follower_id: "u1", profile: { id: "u1", username: "alex", display_name: "Alex" } },
    ]);
    approveFollowRequest.mockResolvedValue("accepted");

    render(<FollowRequests />);

    expect(await screen.findByText("@alex")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /accept/i }));

    await waitFor(() => expect(approveFollowRequest).toHaveBeenCalledWith("u1", expect.objectContaining({user:'me'})));
  });
});
