import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, resolve, sep } from "node:path";
import assert from "node:assert/strict";

export async function hashFile(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}
async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory()
    ? filesUnder(join(directory, entry.name)) : [join(directory, entry.name)]))).flat();
}
export async function verifyPreservation(output) {
  const snapshot = JSON.parse(await readFile(join(output, "preserved-files.json"), "utf8"));
  for (const [path, hash] of Object.entries(snapshot)) assert.equal(await hashFile(path), hash, `Preserved file changed: ${path}`);
  return Object.keys(snapshot).length;
}
if (process.argv[2] === "snapshot") {
  const output = process.argv[3];
  assert(output && resolve(output).startsWith(resolve("src/features/companion/visual-tests/runs") + sep), "Use a new Companion run directory");
  await mkdir("src/features/companion/visual-tests/runs", { recursive: true });
  await mkdir(output, { recursive: false });
  const paths = [
    ...await filesUnder("src/features/companion/prototype"),
    ...await filesUnder("src/features/companion/visual-tests/evidence"),
    "src/features/companion/visual-tests/approved-manifest.json",
    "public/companion/companion-sprite.svg",
    "public/companion/companion-fitted-sprite.svg",
    "src/features/companion/art/companionArt.js",
  ];
  const snapshot = Object.fromEntries(await Promise.all(paths.map(async (path) => [path.replaceAll("\\", "/"), await hashFile(path)])));
  await writeFile(join(output, "preserved-files.json"), JSON.stringify(snapshot, null, 2) + "\n", { flag: "wx" });
  console.log(`Preserved ${await verifyPreservation(output)} files`);
}
