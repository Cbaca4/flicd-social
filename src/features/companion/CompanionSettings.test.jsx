// @vitest-environment jsdom

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CompanionSettings from "./CompanionSettings.jsx";

describe("CompanionSettings", () => {
  it("lets the user turn the companion off and choose a costume", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <CompanionSettings
        value={{ enabled: true, name: "Buddy", costume: "none", animation: "walk", bubbles: true }}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("switch", { name: /show companion/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));

    await user.selectOptions(screen.getByLabelText(/costume/i), "santa");
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ costume: "santa" }));
  });

  it("exposes only the supported companion animations", () => {
    render(
      <CompanionSettings
        value={{ enabled: true, name: "Buddy", costume: "none", animation: "walk", bubbles: true }}
        onChange={() => {}}
      />,
    );

    expect(screen.getByRole("option", { name: /walk/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /sit/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /talk/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /fly|teleport|float/i })).not.toBeInTheDocument();
  });
});
