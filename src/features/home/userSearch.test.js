import { describe, expect, it } from "vitest";
import { filterUsers, normalizeUserSearch } from "./userSearch.js";

describe("user search", () => {
  const users = [
    { username: "maren_", display_name: "Maren" },
    { username: "theo.b", display_name: "Theo Brown" },
    { username: "alex", display_name: "Alex Rivera" },
  ];

  it("normalizes an @handle query", () => {
    expect(normalizeUserSearch("  @Maren_ ")).toBe("maren_");
  });

  it("matches username or display name without requiring exact casing", () => {
    expect(filterUsers(users, "@THEO")).toEqual([users[1]]);
    expect(filterUsers(users, "river")).toEqual([users[2]]);
  });
});
