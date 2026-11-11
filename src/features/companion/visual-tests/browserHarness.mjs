import { createServer } from "vite";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { once } from "node:events";
import assert from "node:assert/strict";
import { stripFixtureFontImports } from "./fixtureStyles.mjs";

export async function withCompanionBrowser(run, { plugins = [] } = {}) {
  const builtCSS = process.env.COMPANION_BUILT_CSS ? await readFile(process.env.COMPANION_BUILT_CSS, "utf8") : null;
  // envDir:false prevents loading credentials. The fixture imports Companion only.
  const server = await createServer({
    configFile: false, envDir: false,
    cacheDir: join(process.env.TMPDIR, "companion-browser-vite-cache"),
    plugins: [...plugins, { name: "companion-fixture-offline-fonts", enforce: "pre", transform(source, id) {
      const path = id.replaceAll("\\", "/");
      if (path.endsWith("/src/styles.css")) return stripFixtureFontImports(builtCSS || source);
      if (builtCSS && ["/src/mobile.css", "/src/features/companion/Companion.css", "/src/features/companion/CompanionCostume.css"].some(suffix => path.endsWith(suffix))) return "";
    } }],
    server: { host: "127.0.0.1", port: 0, open: false }, logLevel: "error",
  });
  await server.listen();
  const url = `http://127.0.0.1:${server.httpServer.address().port}/src/features/companion/visual-tests/index.html`;
  assert(process.env.TMPDIR, "Hermes scratch TMPDIR is required");
  const profile = await mkdtemp(join(process.env.TMPDIR, "companion-full-"));
  let browser;
  let socket;
  try {
    browser = spawn(process.env.COMPANION_TEST_BROWSER || "C:/Program Files/Google/Chrome/Application/chrome.exe", [
      "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
      "--disable-background-networking", "--disable-component-update", "--remote-debugging-port=0",
      `--user-data-dir=${profile}`, "about:blank",
    ], { stdio: ["ignore", "ignore", "pipe"] });
    const endpoint = await new Promise((done, fail) => {
      const timeout = setTimeout(() => fail(new Error("Chrome endpoint timed out")), 20000);
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
    const errors = [];
    const requests = [];
    socket.addEventListener("message", ({ data }) => {
      const message = JSON.parse(data);
      if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails);
      if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") errors.push(message.params.args);
      if (message.method === "Network.requestWillBeSent") requests.push(message.params.request.url);
      const entry = pending.get(message.id);
      if (!entry) return;
      pending.delete(message.id); clearTimeout(entry.timeout);
      if (message.error) entry.fail(new Error(JSON.stringify(message.error))); else entry.done(message.result);
    });
    function send(method, params = {}, sessionId) {
      return new Promise((done, fail) => {
        const id = ++sequence;
        const timeout = setTimeout(() => { pending.delete(id); fail(new Error(`CDP timed out: ${method}`)); }, 120000);
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
    await cdp("Runtime.enable"); await cdp("Page.enable"); await cdp("Network.enable");
    await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await cdp("Page.navigate", { url });
    await evaluate(`new Promise((resolve, reject) => {
      let attempts = 0;
      const wait = () => {
        if (window.companionQA && document.querySelector('.qa-gallery')) resolve(true);
        else if (++attempts > 1000) reject(new Error('Companion fixture failed to mount'));
        else setTimeout(wait, 20);
      }; wait();
    })`);
    async function screenshot(path) {
      await evaluate("document.fonts.ready");
      const { cssContentSize } = await cdp("Page.getLayoutMetrics");
      const { data } = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: cssContentSize.width, height: cssContentSize.height, scale: 1 } });
      await writeFile(path, Buffer.from(data, "base64"), { flag: "wx" });
    }
    await run({ cdp, evaluate, screenshot, errors, requests });
    assert.deepEqual(errors, [], JSON.stringify(errors));
    assert(requests.every((request) => request.startsWith("data:") || new URL(request).hostname === "127.0.0.1"), "Unexpected non-local browser request");
    await send("Browser.close");
  } finally {
    socket?.close();
    if (browser && browser.exitCode === null) {
      await Promise.race([once(browser, "exit"), new Promise((done) => setTimeout(done, 2000))]);
      if (browser.exitCode === null) browser.kill();
    }
    await server.close();
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  }
}
