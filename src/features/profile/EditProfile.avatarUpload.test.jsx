// @vitest-environment jsdom

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const uploadProfilePhoto = vi.hoisted(() => vi.fn());

vi.mock("./profileMedia.js", () => ({
  uploadProfilePhoto,
}));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
      }),
    },
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                id: "user-1",
                username: "baco",
                display_name: "Baco",
                bio: "hello",
                avatar_url: "https://cdn.example/avatar.jpg",
              },
              error: null,
            }),
          })),
        })),
      })),
    })),
  },
}));

import EditProfile from "./EditProfile.jsx";

describe("EditProfile gallery photo upload", () => {
  it("uploads a selected gallery image and saves its URL to the profile", async () => {
    uploadProfilePhoto.mockResolvedValue("https://cdn.example/avatar.jpg");
    const onSaved = vi.fn();
    const file = new File(["avatar"], "avatar.png", { type: "image/png" });

    render(
      <EditProfile
        profile={{ handle: "baco", displayName: "Baco", bio: "hello", avatarUrl: "" }}
        onBack={() => {}}
        onSaved={onSaved}
        onToast={() => {}}
      />,
    );

    const input = screen.getByLabelText("Profile photo");
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByRole("dialog", { name: "Crop profile photo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use this crop" })).toBeInTheDocument();
    expect(uploadProfilePhoto).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
