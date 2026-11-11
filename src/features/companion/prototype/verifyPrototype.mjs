// Dependency-free local-only browser verification. Usage:
// node src/features/companion/prototype/verifyPrototype.mjs [path/to/chrome.exe]
import { createServer } from "node:http";
import { readFile, writeFile, mkdtemp, mkdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { once } from "node:events";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const directory = "src/features/companion/prototype";
// Never overwrite the approved evidence when rechecking the archived prototype.
const output = resolve(root, directory, "rechecks");
await mkdir(output, { recursive: true });
// A portable artifact opens directly from disk without Vite, Auth, or a server.
const [html, css, costumeCss, moduleSource, pageSource, sheet] = await Promise.all([
  readFile(resolve(root, directory, "index.html"), "utf8"),
  readFile(resolve(root, directory, "legacy/Companion.css"), "utf8"),
  readFile(resolve(root, directory, "legacy/CompanionCostume.css"), "utf8"),
  readFile(resolve(root, directory, "costumePrototype.js"), "utf8"),
  readFile(resolve(root, directory, "prototypePage.js"), "utf8"),
  readFile(resolve(root, "public/companion/companion-sprite.svg"), "utf8"),
]);
const embeddedCss = `${costumeCss}\n${css}`.replaceAll('url("/companion/companion-sprite.svg")', `url("data:image/svg+xml,${encodeURIComponent(sheet)}")`);
const embeddedScript = `${moduleSource}\nconst sheet = ${JSON.stringify(sheet)};\n${pageSource.slice(pageSource.indexOf("const definitions ="))}`;
const portable = html
  .replace('<link rel="stylesheet" href="./legacy/Companion.css">', `<style>${embeddedCss}</style>`)
  .replace('<link rel="stylesheet" href="./legacy/CompanionCostume.css">', "")
  .replace('<script type="module" src="./prototypePage.js"></script>', `<script type="module">${embeddedScript}</script>`);
const portablePath = join(output, "review.html");
await writeFile(portablePath, portable);
const files = new Map([
  ["/", [`${directory}/index.html`, "text/html"]],
  ["/prototypePage.js", [`${directory}/prototypePage.js`, "text/javascript"]],
  ["/costumePrototype.js", [`${directory}/costumePrototype.js`, "text/javascript"]],
  ["/legacy/Companion.css", [`${directory}/legacy/Companion.css`, "text/css"]],
  ["/legacy/CompanionCostume.css", [`${directory}/legacy/CompanionCostume.css`, "text/css"]],
  ["/companion/companion-sprite.svg", ["public/companion/companion-sprite.svg", "image/svg+xml"]],
]);
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  const file = files.get(pathname);
  if (!file) { response.writeHead(404); response.end(); return; }
  try {
    const bytes = await readFile(resolve(root, file[0]));
    response.writeHead(200, { "Content-Type": file[1], "Cache-Control": "no-store" });
    response.end(bytes);
  } catch { response.writeHead(500); response.end(); }
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const url = `http://127.0.0.1:${server.address().port}/`;
// Browser profile is disposable, never the operator's personal profile.
assert(process.env.TMPDIR, "Hermes scratch TMPDIR is required");
const profile = await mkdtemp(join(process.env.TMPDIR, "companion-review-"));
let browser;
let socket;
const report = { url, rasterCases: [], checks: [], screenshots: [] };
try {
  browser = spawn(process.argv[2] || "C:/Program Files/Google/Chrome/Application/chrome.exe", [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--disable-background-networking", "--disable-component-update", "--remote-debugging-port=0",
    `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  const endpoint = await new Promise((done, fail) => {
    const timeout = setTimeout(() => fail(new Error("Chrome debugging endpoint timed out")), 20000);
    browser.once("error", (error) => { clearTimeout(timeout); fail(error); });
    let text = "";
    browser.stderr.on("data", (bytes) => {
      text += bytes;
      const match = text.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timeout); done(match[1]); }
    });
    browser.once("exit", (code) => { clearTimeout(timeout); fail(new Error(`Chrome exited early: ${code}`)); });
  });
  socket = new WebSocket(endpoint);
  await once(socket, "open");
  let sequence = 0;
  const pending = new Map();
  const exceptions = [];
  const consoleErrors = [];
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails);
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") consoleErrors.push(message.params.args);
    if (!message.id) return;
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    clearTimeout(entry.timeout);
    if (message.error) entry.fail(new Error(JSON.stringify(message.error)));
    else entry.done(message.result);
  });
  function send(method, params = {}, sessionId) {
    return new Promise((done, fail) => {
      const id = ++sequence;
      const timeout = setTimeout(() => { pending.delete(id); fail(new Error(`CDP timed out: ${method}`)); }, 30000);
      pending.set(id, { done, fail, timeout });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const cdp = (method, params) => send(method, params, sessionId);
  async function evaluate(expression) {
    const result = await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    assert(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  await cdp("Runtime.enable");
  await cdp("Page.enable");
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await cdp("Page.navigate", { url });
  // Wait for the actual module's completion promise, not a guessed sleep.
  await evaluate(`new Promise((resolve, reject) => {
    const started = Date.now();
    const wait = () => {
      if (window.prototypeChecks) window.prototypeChecks.then(resolve, reject);
      else if (Date.now() - started > 15000) reject(new Error('Prototype module did not start'));
      else setTimeout(wait, 20);
    }; wait();
  })`);
  report.rasterCases = await evaluate("window.prototypeChecks");
  assert.equal(report.rasterCases.length, 36);
  assert(report.rasterCases.every((result) => result.passed), JSON.stringify(report.rasterCases.filter((result) => !result.passed)));
  report.checks.push("36 real-browser raster cases: opaque torso containment, protected facial/ear/foot pixels, sharp costume edges");
  assert.deepEqual(await evaluate(`(() => {
    const style = getComputedStyle(document.querySelector('.companion-costume-hero'), '::before');
    return [style.left, style.top];
  })()`), ["12px", "30px"]);
  report.checks.push("Current-art comparison uses the app build's stylesheet order, including its existing override conflict");
  await mkdir(output, { recursive: true });
  async function screenshot(name) {
    await evaluate("Promise.all([...document.images].map(image => image.decode()))");
    const { cssContentSize } = await cdp("Page.getLayoutMetrics");
    const { data } = await cdp("Page.captureScreenshot", {
      format: "png", captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: cssContentSize.width, height: cssContentSize.height, scale: 1 },
    });
    await writeFile(join(output, name), Buffer.from(data, "base64"));
    report.screenshots.push(name);
  }
  await screenshot("desktop-right.png");
  await evaluate("document.querySelector('#facing').value = '-1'; document.querySelector('#facing').dispatchEvent(new Event('change'))");
  assert.equal(await evaluate("getComputedStyle(document.documentElement).getPropertyValue('--facing')"), "-1");
  const transforms = await evaluate("[...document.querySelectorAll('.stage > *')].map(node => getComputedStyle(node).transform)");
  assert(transforms.every((transform) => transform === "matrix(-2, 0, 0, 2, 0, 0)"), JSON.stringify(transforms));
  await screenshot("desktop-left.png");
  report.checks.push("Direction reversal mirrors current and fitted frames together at exact 2x scale");
  await evaluate("document.querySelector('#play').click()");
  assert.equal(await evaluate("document.querySelector('#play').getAttribute('aria-pressed')"), "true");
  const animated = await evaluate(`new Promise(resolve => {
    const title = document.querySelectorAll('.frame h3')[1];
    const before = title.textContent;
    const observer = new MutationObserver(() => {
      const after = document.querySelectorAll('.frame h3')[1].textContent;
      if (after !== before) { observer.disconnect(); resolve(true); }
    }); observer.observe(document.querySelector('#comparisons'), { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); resolve(false); }, 1500);
  })`);
  assert(animated, "Walk frames did not advance");
  await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await evaluate("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
  assert.deepEqual(await evaluate("({ disabled: document.querySelector('#play').disabled, pressed: document.querySelector('#play').getAttribute('aria-pressed') })"), { disabled: true, pressed: "false" });
  report.checks.push("Walk control advances frames; live reduced-motion preference stops playback and disables animation");
  await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  assert(await evaluate("document.documentElement.scrollWidth <= innerWidth"), "Mobile document overflows");
  const mobileTransforms = await evaluate("[...document.querySelectorAll('.stage > *')].map(node => getComputedStyle(node).transform)");
  assert(mobileTransforms.every((transform) => transform === "matrix(-1, 0, 0, 1, 0, 0)"), JSON.stringify(mobileTransforms));
  await screenshot("mobile-left-reduced-motion.png");
  report.checks.push("390px mobile viewport has no horizontal document overflow and renders at exact 1x");
  await evaluate("document.querySelector('#facing').focus()");
  assert(await evaluate("document.activeElement.id === 'facing'"));
  report.checks.push("Native direction control is focusable; explicit labels and focus styles remain available (not a full accessibility audit)");
  await cdp("Page.navigate", { url: pathToFileURL(portablePath).href });
  const portableResults = await evaluate(`new Promise((resolve, reject) => {
    const started = Date.now();
    const wait = () => {
      if (window.prototypeChecks) window.prototypeChecks.then(resolve, reject);
      else if (Date.now() - started > 15000) reject(new Error('Portable prototype did not start'));
      else setTimeout(wait, 20);
    }; wait();
  })`);
  assert.equal(portableResults.length, 36);
  assert(portableResults.every((result) => result.passed), "Portable raster checks failed");
  await evaluate("Promise.all([...document.images].map(image => image.decode()))");
  report.checks.push("Self-contained review.html opens directly from disk and passes the same 36 raster cases without a server");
  assert.deepEqual(exceptions, [], JSON.stringify(exceptions));
  assert.deepEqual(consoleErrors, [], JSON.stringify(consoleErrors));
  report.checks.push("No JavaScript exceptions or console.error calls");
  await writeFile(join(output, "browser-results.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  await send("Browser.close");
} finally {
  socket?.close();
  if (browser && browser.exitCode === null) {
    await Promise.race([once(browser, "exit"), new Promise((done) => setTimeout(done, 3000))]);
    if (browser.exitCode === null) browser.kill();
  }
  server.closeAllConnections();
  server.close();
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
}
