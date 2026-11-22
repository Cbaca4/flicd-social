/** @vitest-environment jsdom */
import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const auth = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));
vi.mock("../../lib/supabase", () => ({ supabase: { auth } }));
import Auth from "./Auth.jsx";

beforeEach(() => {
  vi.resetAllMocks();
});
afterEach(cleanup);

describe("authentication release flows", () => {
  it("does not report a successful login when signup requires email confirmation", async () => {
    const onLogin = vi.fn();
    auth.signUp.mockResolvedValue({ data: { user: { id: "new" }, session: null }, error: null });
    render(<Auth onLogin={onLogin} />);
    fireEvent.click(screen.getByRole("button", { name: /Don't have an account/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Username" }), { target: { value: "new_member" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Email" }), { target: { value: "new@example.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secure-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Check your email");
    expect(auth.signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: "new@example.test",
      options: { data: { username: "new_member" } },
    }));
    expect(onLogin).not.toHaveBeenCalled();
  });

  it("accepts an actual authenticated login session", async () => {
    const onLogin = vi.fn();
    auth.signInWithPassword.mockResolvedValue({ data: { session: { access_token: "fixture" } }, error: null });
    render(<Auth onLogin={onLogin} />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "member@example.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "mypassword" } });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() => expect(onLogin).toHaveBeenCalledOnce());
  });

  it("offers password recovery with a non-enumerating confirmation", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    render(<Auth />);
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "missing@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset email" }));
    expect(await screen.findByRole("status")).toHaveTextContent("If this address has an account");
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("missing@example.test");
    expect(screen.getByRole("button", { name: "Back to log in" })).toBeInTheDocument();
  });
});
