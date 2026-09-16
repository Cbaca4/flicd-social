/** @vitest-environment jsdom */
import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import UserSearch from "./UserSearch.jsx";

const fromMock = vi.fn();

vi.mock("../../lib/supabase", () => ({
  supabase: {
    from: fromMock,
  },
}));

describe("UserSearch public profile navigation", () => {
  beforeEach(() => {
    fromMock.mockReset();
    fromMock.mockReturnValue({
      select: () => ({
        or: async () => ({
          data: [
            {
              id: "profile-123",
              username: "maren_",
              display_name: "Maren",
              bio: "moments + coffee",
              avatar_url: "",
              profile_theme: null,
            },
          ],
          error: null,
        }),
      }),
    });
  });

  it("calls onUserSelect with the selected profile", async () => {
    const onUserSelect = vi.fn();

    render(
      <UserSearch
        onClose={vi.fn()}
        onUserSelect={onUserSelect}
      />
    );

    fireEvent.change(screen.getByLabelText("Search users"), {
      target: { value: "maren" },
    });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /@maren_/i })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: /@maren_/i }));

    expect(onUserSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "profile-123",
        username: "maren_",
      })
    );
  });
});
