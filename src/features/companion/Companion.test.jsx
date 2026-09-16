/** @vitest-environment jsdom */

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Companion from "./Companion.jsx";

const christmas = {
  id: "christmas",
  label: "Christmas",
  character: { hat: "santa", accessory: "scarf" },
  interaction: { target: "snow", reaction: "playful" },
};

afterEach(() => cleanup());

describe("Companion", () => {
  it("renders a capybara companion", () => {
    render(<Companion userId="u1" enabled seasonalEvent={null} />);
    expect(screen.getByRole("button", { name: /capybara companion/i })).toBeInTheDocument();
  });

  it("reacts when tapped", async () => {
    const user = userEvent.setup();
    render(<Companion userId="u1" enabled seasonalEvent={null} />);
    await user.click(screen.getByRole("button", { name: /capybara companion/i }));
    expect(screen.getByText("✨")).toBeInTheDocument();
  });

  it("shows seasonal capybara treatment from event data", () => {
    render(<Companion userId="u1" enabled seasonalEvent={christmas} />);
    expect(screen.getByRole("button", { name: /Christmas capybara companion/i })).toBeInTheDocument();
    expect(screen.getByText("🎅")).toBeInTheDocument();
    expect(screen.getByText("🧣")).toBeInTheDocument();
  });

  it("switches to quiet mode", async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();
    render(<Companion userId="u1" enabled seasonalEvent={null} onModeChange={onModeChange} />);
    await user.click(screen.getByRole("button", { name: /enable quiet mode/i }));
    expect(onModeChange).toHaveBeenCalledWith("quiet");
  });

  it("does not react while quiet mode is enabled", async () => {
    const user = userEvent.setup();
    render(<Companion userId="u1" enabled seasonalEvent={null} />);
    await user.click(screen.getByRole("button", { name: /enable quiet mode/i }));
    await user.click(screen.getByRole("button", { name: /capybara companion/i }));
    expect(screen.queryByText("✨")).toBeNull();
  });
});
