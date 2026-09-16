// @vitest-environment jsdom

import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Companion from "./Companion.jsx";

const christmas = {
  id: "christmas",
  label: "Christmas",
  character: { hat: "santa", accessory: "scarf" },
  interaction: { target: "snow", reaction: "playful" },
};

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("Companion", () => {
  it("renders inside the dedicated companion zone", () => {
    render(<Companion userId="u1" seasonalEvent={null} />);
    expect(screen.getByTestId("companion-zone")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Buddy the capybara companion/i })).toBeInTheDocument();
  });

  it("reacts when tapped", async () => {
    const user = userEvent.setup();
    render(<Companion userId="u1" seasonalEvent={null} />);
    await user.click(screen.getByRole("button", { name: /Buddy the capybara companion/i }));
    expect(screen.getByText("✨")).toBeInTheDocument();
  });

  it("uses a supported seasonal costume without exposing drag or mode controls", () => {
    localStorage.setItem("flicd:companion:u1:settings", JSON.stringify({ enabled: true, name: "Buddy", costume: "santa", animation: "walk", bubbles: true, reactions: true }));
    render(<Companion userId="u1" seasonalEvent={christmas} />);
    expect(screen.getByText("🎅")).toBeInTheDocument();
    expect(screen.queryByTitle(/drag me around/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /quiet mode|companion mode/i })).toBeNull();
  });

  it("returns no UI when the persisted companion setting is disabled", () => {
    localStorage.setItem("flicd:companion:u1:settings", JSON.stringify({ enabled: false }));
    render(<Companion userId="u1" seasonalEvent={null} />);
    expect(screen.queryByTestId("companion-zone")).toBeNull();
  });

  it("shows talk bubbles only for the supported talk animation", () => {
    localStorage.setItem("flicd:companion:u1:settings", JSON.stringify({ enabled: true, name: "Buddy", costume: "none", animation: "talk", bubbles: true, reactions: true }));
    render(<Companion userId="u1" seasonalEvent={null} />);
    expect(screen.getByText("just vibin' 🦫")).toBeInTheDocument();
  });
});
