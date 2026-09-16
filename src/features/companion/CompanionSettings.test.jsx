// @vitest-environment jsdom

import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CompanionSettings from "./CompanionSettings.jsx";

afterEach(() => {
  cleanup();
});

describe("CompanionSettings", () => {
  it("lets the user turn the companion off and choose a costume", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <CompanionSettings
        value={{
          enabled: true,
          name: "Buddy",
          costume: "none",
          animation: "walk",
          bubbles: true,
          reactions: true,
        }}
        onChange={onChange}
      />,
    );

    await user.click(
      screen.getByRole("switch", {
        name: /show companion/i,
      }),
    );

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      }),
    );

    await user.selectOptions(
      screen.getByLabelText(/costume/i),
      "santa",
    );

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        costume: "santa",
      }),
    );
  });

  it("exposes only the supported companion animations", () => {
    render(
      <CompanionSettings
        value={{
          enabled: true,
          name: "Buddy",
          costume: "none",
          animation: "walk",
          bubbles: true,
          reactions: true,
        }}
        onChange={() => {}}
      />,
    );

    const select = screen.getByRole("combobox", {
      name: /default animation/i,
    });

    expect(
      Array.from(select.options).map((option) => option.value),
    ).toEqual(["walk", "sit", "talk"]);
  });
});
