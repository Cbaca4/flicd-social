// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { stripFixtureFontImports } from "./fixtureStyles.mjs";

afterEach(() => { document.head.innerHTML = ""; document.documentElement.removeAttribute("style"); });
const applicationCSS = readFileSync("src/styles.css", "utf8");

it("preserves the real application root theme when removing its offline font import", () => {
  const imported = applicationCSS.slice(0, applicationCSS.indexOf("\n"));
  expect(imported).toContain("400;500;600;700");
  expect(stripFixtureFontImports(applicationCSS).startsWith("\n:root{")).toBe(true);
  expect(stripFixtureFontImports(applicationCSS)).toBe(applicationCSS.slice(imported.length));
});

it.each([
  "@import url('https://fonts.googleapis.com/css2?family=Test:wght@400;700');",
  '@import url("https://fonts.googleapis.com/css2?family=Test:wght@400;700");',
  '@import"https://fonts.googleapis.com/css2?family=Test:wght@400;700";',
  "@import url( 'https://fonts.googleapis.com/css2?family=Test:wght@400;700' );",
])("removes the complete quoted font URL, not a semicolon-delimited prefix: %s", (fontImport) => {
  const body = ":root{--cyan:#46dac8}.companion-character:focus-visible{outline:3px solid var(--cyan);outline-offset:4px}";
  const transformed = stripFixtureFontImports(fontImport + body);
  expect(transformed).toBe(body);
  const style = document.createElement("style");
  style.textContent = transformed;
  document.head.append(style);
  expect(getComputedStyle(document.documentElement).getPropertyValue("--cyan").trim()).toBe("#46dac8");
});

it("leaves unrelated imports and already-offline styles byte-for-byte unchanged", () => {
  for (const source of ['@import "./local.css";:root{--cyan:#46dac8}', ':root{--cyan:#46dac8}', '@import url("https://example.invalid/font.css");']) {
    expect(stripFixtureFontImports(source)).toBe(source);
  }
});
