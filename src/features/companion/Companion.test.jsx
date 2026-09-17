// @vitest-environment jsdom

import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Companion from "./Companion.jsx";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  cleanup();
  localStorage.clear();
});

describe("Companion", () => {
  it("renders a retro 16-bit capybara companion without a nameplate", () => {
    render(<Companion userId="u1" />);

    expect(
      screen.getByRole("button", {
        name: /Buddy the capybara companion/i,
      }),
    ).toBeInTheDocument();

    expect(screen.getByTestId("companion-zone")).toBeInTheDocument();
    expect(screen.getByTestId("capybara-pixel-sprite")).toHaveAttribute(
      "data-sprite-style",
      "retro-16bit",
    );
    expect(screen.queryByText("Buddy")).not.toBeInTheDocument();
  });

  it("reacts when tapped", async () => {
    const user = userEvent.setup();
    vi.spyOn(Math, "random").mockReturnValue(0);

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
        reactions: true,
      }),
    );

    render(<Companion userId="u1" />);

    expect(screen.getByTestId("capybara-pixel-sprite")).toHaveStyle({
      "--sprite-row": "1",
    });
  });

  it("supports only walking and sitting modes", () => {
    localStorage.setItem(
      "flicd:companion:u1:settings",
      JSON.stringify({
        enabled: true,
        name: "Buddy",
        costume: "none",
        animation: "talk",
        reactions: true,
      }),
    );

    render(<Companion userId="u1" />);

    const walker = screen
      .getByTestId("companion-zone")
      .querySelector(".companion-walker");

    expect(walker).toHaveClass("companion-walk");
    expect(screen.queryByText("just vibin' 🦫")).not.toBeInTheDocument();
  });

  it("uses a slow patrol leg and a measured walk cycle", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);

    render(<Companion userId="u1" />);

    await act(async () => {
      vi.advanceTimersByTime(4500);
    });

    const walker = screen
      .getByTestId("companion-zone")
      .querySelector(".companion-walker");

    expect(walker).toHaveClass("companion-motion-walking");
    expect(walker).toHaveStyle({
      "--companion-travel-duration": "41250ms",
      "--companion-walk-cycle": "1400ms",
    });
    expect(walker).toHaveAttribute("data-movement", "continuous");
    expect(walker).toHaveAttribute("data-walk-speed", "slow");
  });

  it("freezes at the current on-screen position when sitting is selected", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);

    render(<Companion userId="u1" />);

    await act(async () => {
      vi.advanceTimersByTime(4500);
    });

    const zone = screen.getByTestId("companion-zone");
    const walker = zone.querySelector(".companion-walker");

    vi.spyOn(zone, "getBoundingClientRect").mockReturnValue({
      left: 100,
      top: 0,
      right: 1100,
      bottom: 100,
      width: 1000,
      height: 100,
      x: 100,
      y: 0,
      toJSON: () => {},
    });
    vi.spyOn(walker, "getBoundingClientRect").mockReturnValue({
      left: 520,
      top: 20,
      right: 616,
      bottom: 98,
      width: 96,
      height: 78,
      x: 520,
      y: 20,
      toJSON: () => {},
    });

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("flicd:companion-settings", {
          detail: {
            enabled: true,
            name: "Buddy",
            costume: "none",
            animation: "sit",
            reactions: true,
          },
        }),
      );
    });

    expect(walker).toHaveClass("companion-sit");
    expect(walker).not.toHaveClass("companion-motion-walking");
    expect(walker).toHaveStyle({
      "--companion-position": "42%",
      "--companion-travel-duration": "0ms",
    });
  });

  it("stops the walking transition immediately when sitting is selected", async () => {
    vi.useFakeTimers();
    render(<Companion userId="u1" />);

    await act(async () => {
      vi.advanceTimersByTime(4500);
    });

    const walker = screen
      .getByTestId("companion-zone")
      .querySelector(".companion-walker");

    expect(walker).toHaveClass("companion-walk");

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("flicd:companion-settings", {
          detail: {
            enabled: true,
            name: "Buddy",
            costume: "none",
            animation: "sit",
            reactions: true,
          },
        }),
      );
    });

    expect(walker).toHaveClass("companion-sit");
    expect(walker).not.toHaveClass("companion-motion-walking");
    expect(walker.style.getPropertyValue("--companion-travel-duration")).toBe(
      "0ms",
    );
  });

  it("hides when disabled", () => {
    localStorage.setItem(
      "flicd:companion:u1:settings",
      JSON.stringify({
        enabled: false,
        name: "Buddy",
        costume: "none",
        animation: "walk",
        reactions: true,
      }),
    );

    render(<Companion userId="u1" />);

    expect(screen.queryByTestId("companion-zone")).not.toBeInTheDocument();
  });
});
