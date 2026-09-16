// @vitest-environment jsdom

import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Companion from "./Companion.jsx";
import CompanionSettings from "./CompanionSettings.jsx";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("Pixel companion redesign", () => {
  it("renders a chunky pixel-art sprite from the sprite sheet", () => {
    render(<Companion userId="pixel-test" />);

    const character = screen.getByRole("button", {
      name: /Buddy the capybara companion/i,
    });

    expect(character).toHaveClass("companion-character");
    expect(
      character.querySelector(".capybara-pixel-sprite"),
    ).toBeInTheDocument();
  });

  it("renders an actual costume from the sprite sheet", () => {
    localStorage.setItem(
      "flicd:companion:pixel-test:settings",
      JSON.stringify({
        enabled: true,
        name: "Buddy",
        costume: "santa",
        animation: "walk",
        bubbles: true,
        reactions: true,
      }),
    );

    render(<Companion userId="pixel-test" />);

    const sprite = screen
      .getByRole("button", {
        name: /Buddy the capybara companion/i,
      })
      .querySelector(".capybara-pixel-sprite");

    expect(sprite).toHaveStyle({
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
          bubbles: true,
          reactions: true,
        }),
      );

      render(<Companion userId="pixel-test" />);

      expect(
        screen
          .getByRole("button", {
            name: /Buddy the capybara companion/i,
          })
          .querySelector(".capybara-pixel-sprite"),
      ).toHaveStyle({
        "--sprite-row": row,
      });
    }
  });

  it("uses a slower walking patrol", () => {
    render(<Companion userId="pixel-test" />);

    const walker = screen
      .getByTestId("companion-zone")
      .querySelector(".companion-walker");

    expect(walker).toHaveClass("companion-walk");
    expect(walker).toHaveAttribute("data-walk-speed", "slow");
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
          bubbles: true,
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
