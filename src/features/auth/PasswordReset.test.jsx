/** @vitest-environment jsdom */
import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const updateUser = vi.hoisted(() => vi.fn());
vi.mock("../../lib/supabase", () => ({ supabase: { auth: { updateUser } } }));
import PasswordReset from "./PasswordReset.jsx";
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("confirmed password recovery", () => {
  it("does not accept mismatched passwords or call the auth service", async () => {
    render(<PasswordReset />);
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "very-secure-pass" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "another-secure-pass" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Passwords do not match");
    expect(updateUser).not.toHaveBeenCalled();
  });
  it("updates the authenticated recovery session and then continues", async () => {
    updateUser.mockResolvedValue({ data: {}, error: null });
    const onComplete = vi.fn();
    render(<PasswordReset onComplete={onComplete} />);
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "new-secure-password" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "new-secure-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
    expect(updateUser).toHaveBeenCalledWith({ password: "new-secure-password" });
  });
});
