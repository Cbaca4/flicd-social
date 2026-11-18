// @vitest-environment jsdom

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderAccount } from "../../../tests/security/renderAccount.jsx";

const uploadProfilePhoto = vi.hoisted(() => vi.fn());
const validateProfilePhoto = vi.hoisted(() => vi.fn());

vi.mock("./profileMedia.js", () => ({
  uploadProfilePhoto,
  validateProfilePhoto,
}));

vi.mock("../../lib/supabase", () => {
  const client = {
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
  };
  return { supabase: client, createAccountClient: () => client };
});

import EditProfile from "./EditProfile.jsx";

if (!URL.createObjectURL) URL.createObjectURL = vi.fn(() => "blob:profile-test");
if (!URL.revokeObjectURL) URL.revokeObjectURL = vi.fn();
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

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

  it("keeps the preview object URL alive across React Strict Mode's mount-effect replay", () => {
    let serial = 0;
    const create = vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:strict-" + ++serial);
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const file = new File(["avatar"], "avatar.png", { type: "image/png" });
    const { unmount } = render(
      <React.StrictMode>
        <EditProfile profile={{ handle: "baco", avatarUrl: "" }} />
      </React.StrictMode>,
    );

    fireEvent.change(screen.getByLabelText("Profile photo"), { target: { files: [file] } });
    const img = screen.getByRole("img", { name: "Profile photo crop preview" });
    expect(create).toHaveBeenCalledTimes(2);
    expect(img.getAttribute("src")).toBe("blob:strict-2");
    expect(revoke).toHaveBeenCalledWith("blob:strict-1");
    expect(revoke).not.toHaveBeenCalledWith("blob:strict-2");
    expect(screen.getByRole("button", { name: "Use this crop" }).disabled).toBe(true);
    unmount();
    expect(revoke).toHaveBeenCalledWith("blob:strict-2");
  });

  it("previews a decoded image and crops that exact image instead of reloading a blob URL", async () => {
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage });
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(callback => callback(new Blob(["cropped"], { type: "image/webp" })));
    uploadProfilePhoto.mockResolvedValue("https://cdn.example/avatar.jpg");
    const onSaved = vi.fn();
    const file = new File(["avatar"], "avatar.png", { type: "image/png" });

    renderAccount(
      <React.StrictMode>
        <EditProfile
          profile={{ id: "user-1", handle: "baco", displayName: "Baco" }}
          onSaved={onSaved}
        />
      </React.StrictMode>,
      "user-1",
    );

    fireEvent.change(screen.getByLabelText("Profile photo"), { target: { files: [file] } });
    const img = screen.getByRole("img", { name: "Profile photo crop preview" });
    Object.defineProperties(img, {
      naturalWidth: { configurable: true, value: 1024 },
      naturalHeight: { configurable: true, value: 768 },
      complete: { configurable: true, value: true },
    });
    fireEvent.load(img);
    expect(screen.getByRole("button", { name: "Use this crop" }).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Use this crop" }));
    await waitFor(() => expect(uploadProfilePhoto).toHaveBeenCalledOnce());
    expect(drawImage).toHaveBeenCalledWith(img, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number), 0, 0, 720, 720);
    expect(uploadProfilePhoto.mock.calls[0][0].type).toBe("image/webp");
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  });
});
