import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { buildFittedSheet } from "./companionArt.js";

const path = "public/companion/companion-fitted-sprite.svg";
const sheet = buildFittedSheet(await readFile("public/companion/companion-sprite.svg", "utf8"));
if (process.argv.includes("--check")) {
  assert.equal(await readFile(path, "utf8"), sheet, "Generated Companion art is stale; rerun the generator");
  console.log("PASS: generated Companion sprite matches its source");
} else {
  await writeFile(path, sheet);
  console.log(`Generated ${path} (${Buffer.byteLength(sheet)} bytes)`);
}
