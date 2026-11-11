import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Linked checkouts are separate repositories with their own cwd/fixtures.
    // Retain Vitest defaults and every first-party test in this worktree.
    exclude: [...configDefaults.exclude, "**/.worktrees/**"],
  },
});
