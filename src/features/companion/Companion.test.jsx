// @vitest-environment jsdom

import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Companion from "./Companion.jsx";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("Companion", () => {
  it("renders a capybara companion", () => {
    render(<Companion userId="u1" />);

    expect(
      screen.getByRole("button", {
        name: /Buddy the capybara companion/i,
      }),
    ).toBeInTheDocument();

    expect(screen.getByTestId("companion-zone")).toBeInTheDocument();
  });

  it("reacts when tapped", async () => {
    const user = userEvent.setup();

    render(<Companion userId="u1" />);

    await user.click(
      screen.getByRole("button", {
        name: /Buddy the capybara companion/i,
      }),
    );

    expect(screen.getByText("✨")).toBeInTheDocument();
  });

  it("shows the configured costume", () => {
    localStorage.setItem(
      "flicd:companion:u1:settings",
      JSON.stringify({
        enabled: true,
        name: "Buddy",
        costume: "santa",
        animation: "walk",
        bubbles: true,
        reactions: true,
      }),
    );

    render(<Companion userId="u1" />);

    expect(
      screen.getByRole("button", {
        name: /Buddy the capybara companion/i,
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("🎅")).toBeInTheDocument();
  });

  it("shows talk bubbles in talk mode", () => {
    localStorage.setItem(
      "flicd:companion:u1:settings",
      JSON.stringify({
        enabled: true,
        name: "Buddy",
        costume: "none",
        animation: "talk",
        bubbles: true,
        reactions: true,
      }),
    );

    render(<Companion userId="u1" />);

    expect(screen.getByText("just vibin' 🦫")).toBeInTheDocument();
  });

  it("hides when disabled", () => {
    localStorage.setItem(
      "flicd:companion:u1:settings",
      JSON.stringify({
        enabled: false,
        name: "Buddy",
        costume: "none",
        animation: "walk",
        bubbles: true,
        reactions: true,
      }),
    );

    render(<Companion userId="u1" />);

    expect(screen.queryByTestId("companion-zone")).not.toBeInTheDocument();
  });
});
