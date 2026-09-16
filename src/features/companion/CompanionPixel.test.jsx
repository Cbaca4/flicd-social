// @vitest-environment jsdom

import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import Companion from "./Companion.jsx";
import CompanionSettings from "./CompanionSettings.jsx";

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  localStorage.clear();
});

describe("Retro 16-bit companion redesign", () => {
  it("renders a retro 16-bit capybara with ten visible walk frames", () => {
    render(<Companion userId="pixel-test" />);

    const sprite = screen.getByTestId("capybara-pixel-sprite");

    expect(sprite).toHaveAttribute("data-sprite-style", "retro-16bit");
    expect(sprite).toHaveAttribute("data-leg-detail", "visible");
    expect(sprite).toHaveAttribute("data-walk-frames", "10");
    expect(sprite).toHaveAttribute("data-sprite-sheet", "1152x360");
  });

  it("renders an actual costume from the sprite sheet", () => {
    localStorage.setItem(
      "flicd:companion:pixel-test:settings",
      JSON.stringify({
        enabled: true,
        name: "Buddy",
        costume: "santa",
        animation: "walk",
        reactions: true,
      }),
    );

    render(<Companion userId="pixel-test" />);

    expect(screen.getByTestId("capybara-pixel-sprite")).toHaveStyle({
      "--sprite-row": "1",
    });
  });

  it("supports seasonal ghost and santa outfits", () => {
    for (const [costume, row] of [
      ["ghost", "2"],
      ["santa", "1"],
    ]) {
      cleanup();
      localStorage.clear();

      localStorage.setItem(
        "flicd:companion:pixel-test:settings",
        JSON.stringify({
          enabled: true,
          name: "Buddy",
          costume,
          animation: "walk",
          reactions: true,
        }),
      );

      render(<Companion userId="pixel-test" />);

      expect(screen.getByTestId("capybara-pixel-sprite")).toHaveStyle({
        "--sprite-row": row,
      });
    }
  });

  it("supports superhero preset costumes without changing the base sprite frame", () => {
    localStorage.setItem(
      "flicd:companion:pixel-test:settings",
      JSON.stringify({
        enabled: true,
        name: "Buddy",
        costume: "hero",
        animation: "walk",
        reactions: true,
      }),
    );

    render(<Companion userId="pixel-test" />);

    const sprite = screen.getByTestId("capybara-pixel-sprite");

    expect(sprite).toHaveClass("companion-costume-hero");
    expect(sprite).toHaveStyle({ "--sprite-row": "0" });
  });

  it("starts in an idle pause before autonomous walking begins", async () => {
    vi.useFakeTimers();
    render(<Companion userId="pixel-test" />);

    const walker = screen
      .getByTestId("companion-zone")
      .querySelector(".companion-walker");

    expect(walker).toHaveAttribute("data-motion-state", "idle");

    await act(async () => {
      vi.advanceTimersByTime(4499);
    });
    expect(walker).toHaveAttribute("data-motion-state", "idle");

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(walker).toHaveAttribute("data-motion-state", "walking");
  });

  it("uses a bounded position and deliberately slow continuous travel", async () => {
    vi.useFakeTimers();
    render(<Companion userId="pixel-test" />);

    const walker = screen
      .getByTestId("companion-zone")
      .querySelector(".companion-walker");

    await act(async () => {
      vi.advanceTimersByTime(4500);
    });

    const position = Number.parseFloat(
      walker.style.getPropertyValue("--companion-position"),
    );
    const duration = Number.parseInt(
      walker.style.getPropertyValue("--companion-travel-duration"),
      10,
    );

    expect(position).toBeGreaterThanOrEqual(10);
    expect(position).toBeLessThanOrEqual(73);
    expect(duration).toBeGreaterThanOrEqual(16000);
    expect(walker).toHaveAttribute("data-movement", "continuous");
  });

  it("returns to an idle pause after each slow patrol leg", async () => {
    vi.useFakeTimers();
    render(<Companion userId="pixel-test" />);

    const walker = screen
      .getByTestId("companion-zone")
      .querySelector(".companion-walker");

    await act(async () => {
      vi.advanceTimersByTime(4500);
    });

    const duration = Number.parseInt(
      walker.style.getPropertyValue("--companion-travel-duration"),
      10,
    );

    await act(async () => {
      vi.advanceTimersByTime(duration);
    });

    expect(walker).toHaveAttribute("data-motion-state", "idle");
  });

  it("stops the walk transition immediately when switched to sit", async () => {
    vi.useFakeTimers();
    render(<Companion userId="pixel-test" />);

    await act(async () => {
      vi.advanceTimersByTime(4500);
    });

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

    const walker = screen
      .getByTestId("companion-zone")
      .querySelector(".companion-walker");

    await act(async () => {});

    expect(walker).toHaveClass("companion-sit");
    expect(walker).toHaveStyle({
      "--companion-travel-duration": "0ms",
    });
    expect(walker).not.toHaveClass("companion-motion-walking");
  });

  it("responds with a reaction or short phrase and uses a containerless live status", async () => {
    vi.useFakeTimers();
    render(<Companion userId="pixel-test" />);

    fireEvent.click(
      screen.getByRole("button", {
        name: /Buddy the capybara companion/i,
      }),
    );

    const reaction = screen.getByRole("status", {
      name: /Companion reaction:/i,
    });

    expect(reaction).toHaveClass("companion-reaction");
    expect(reaction.textContent.length).toBeGreaterThan(0);

    await act(async () => {
      vi.advanceTimersByTime(1600);
    });

    expect(
      screen.queryByRole("status", { name: /Companion reaction:/i }),
    ).not.toBeInTheDocument();
  });

  it("uses seasonal reaction copy when a seasonal event is active", () => {
    render(
      <Companion
        userId="pixel-test"
        seasonalEvent={{
          id: "halloween",
          label: "Halloween",
          interaction: { target: "candy", reaction: "excited" },
        }}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /Buddy the capybara companion/i,
      }),
    );

    const reaction = screen.getByRole("status", {
      name: /Companion reaction:/i,
    });

    expect(
      ["🎃", "👻", "🦇", "🍬", "spooky!", "trick or treat!", "boo!"],
    ).toContain(reaction.textContent);
  });

  it("does not render the removed talk feature", () => {
    render(<Companion userId="pixel-test" />);

    expect(screen.queryByText("just vibin' 🦫")).not.toBeInTheDocument();
    expect(
      screen.getByTestId("companion-zone").querySelector(".companion-talk"),
    ).not.toBeInTheDocument();
  });

  it("keeps the companion inside its dedicated zone", () => {
    render(<Companion userId="pixel-test" />);

    const zone = screen.getByTestId("companion-zone");

    expect(zone).toHaveClass("companion-zone");
    expect(zone.querySelector(".companion-walker")).toBeInTheDocument();
  });

  it("previews the selected outfit in Settings", () => {
    render(
      <CompanionSettings
        value={{
          enabled: true,
          name: "Buddy",
          costume: "ghost",
          animation: "walk",
          reactions: true,
        }}
        onChange={() => {}}
      />,
    );

    expect(
      screen.getByTestId("companion-preview-sprite"),
    ).toHaveStyle({
      "--sprite-row": "2",
    });
  });
});
