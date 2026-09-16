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
import { normalizeCompanionSettings } from "./companionSettingsConfig.js";

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

  it("lets the name field be cleared completely", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <CompanionSettings
        value={{
          enabled: true,
          name: "Buddy",
          costume: "none",
          animation: "walk",
          reactions: true,
        }}
        onChange={onChange}
      />,
    );

    const input = screen.getByLabelText(/companion name/i);
    await user.clear(input);

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        name: "",
      }),
    );
  });

  it("preserves an intentionally empty companion name", () => {
    expect(normalizeCompanionSettings({ name: "" }).name).toBe("");
  });

  it("exposes only walking and sitting companion animations", () => {
    render(
      <CompanionSettings
        value={{
          enabled: true,
          name: "Buddy",
          costume: "none",
          animation: "walk",
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
    ).toEqual(["walk", "sit"]);
  });

  it("does not render a talk bubbles setting", () => {
    render(
      <CompanionSettings
        value={{
          enabled: true,
          name: "Buddy",
          costume: "none",
          animation: "walk",
          reactions: true,
        }}
        onChange={() => {}}
      />,
    );

    expect(screen.queryByText(/talk bubbles/i)).not.toBeInTheDocument();
  });
});
