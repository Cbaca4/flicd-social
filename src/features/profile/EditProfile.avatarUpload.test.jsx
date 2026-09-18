// @vitest-environment jsdom

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const uploadProfilePhoto = vi.hoisted(() => vi.fn());
const validateProfilePhoto = vi.hoisted(() => vi.fn());

vi.mock("./profileMedia.js", () => ({
  uploadProfilePhoto,
  validateProfilePhoto,
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

if (!URL.createObjectURL) URL.createObjectURL = vi.fn(() => "blob:profile-test");
if (!URL.revokeObjectURL) URL.revokeObjectURL = vi.fn();

describe("EditProfile gallery photo upload", () => {
  it("opens the cropper for a selected gallery image before uploading", () => {
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

    expect(screen.getByRole("dialog", { name: "Crop profile photo" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Use this crop" })).toBeTruthy();
    expect(validateProfilePhoto).toHaveBeenCalledWith(file);
    expect(uploadProfilePhoto).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
