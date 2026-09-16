// @vitest-environment jsdom

import React from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import AppShell from "./AppShell.jsx";

beforeEach(cleanup);

describe("AppShell persistent companion and dock", () => {
  it("renders the companion in its dedicated zone above the primary dock", async () => {
    render(
      <AppShell userId="u1" screen="home" onNavigate={() => {}} onCapture={() => {}}>
        <div className="screen"><div>content</div></div>
      </AppShell>,
    );

    const companionZone = await screen.findByTestId("companion-zone");
    const dock = screen.getByRole("navigation", { name: /primary navigation/i });

    expect(companionZone).toHaveClass("companion-zone");
    expect(dock).toHaveClass("bottom-dock");
    expect(companionZone.compareDocumentPosition(dock) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
