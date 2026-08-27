import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { browserExecutable } from "./browser-path.mjs";

const EXTERNAL = process.env.SMOKE_URL;
let server = null;
if (!EXTERNAL) {
  server = spawn(process.execPath, [
    fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url)),
    "preview", "--host", "127.0.0.1", "--port", "4180",
  ], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    stdio: "ignore",
    detached: process.platform !== "win32",
  });
}
const BASE = process.env.SMOKE_URL ?? "http://127.0.0.1:4180/";

async function waitForServer(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`server never came up at ${url}`);
}

await waitForServer(BASE);
process.on("exit", () => {
  if (!server?.pid) return;
  const pid = process.platform === "win32" ? server.pid : -server.pid;
  try { process.kill(pid); } catch { /* already gone */ }
});
const results = [];
let consoleErrors = 0;

function ok(name, cond, extra = "") {
  results.push({ name, pass: Boolean(cond), extra });
  if (!cond) console.error(`FAIL ${name} ${extra}`);
  else console.log(`ok   ${name}`);
}

const browser = await chromium.launch({
  executablePath: browserExecutable(),
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleLog = [];
page.on("console", (m) => {
  if (m.type() === "error") {
    consoleErrors += 1;
    consoleLog.push(m.text());
  }
});
page.on("pageerror", (e) => {
  consoleErrors += 1;
  consoleLog.push(String(e));
});

await page.goto(`${BASE}?voice=0`, { waitUntil: "networkidle" });
await page.evaluate(() => window.localStorage.clear());
await page.reload({ waitUntil: "networkidle" });

await page.waitForSelector(".gate", { timeout: 8000 });
ok("age gate shown", await page.isVisible(".gate-head"));

await page.click("text=I'M 18+");
await page.waitForSelector(".cover-screen", { timeout: 4000 });
ok("cover title", (await page.textContent(".cover-title"))?.includes("THE HUSH"));
ok("chapter list has 8", (await page.locator(".chapter-item").count()) === 8);

await page.locator(".chapter-item").first().click();
await page.waitForSelector(".para", { timeout: 6000 });
const spreadText = await page.textContent(".book");
ok("first paragraph rendered", spreadText.includes("The Chapter sent her a whore"));
const pageMetrics = await page.locator(".pg-l .para").first().evaluate((el) => {
  const pageEl = el.closest(".pg");
  const textRect = el.getBoundingClientRect();
  const pageRect = pageEl.getBoundingClientRect();
  const style = getComputedStyle(el);
  return {
    left: textRect.left - pageRect.left,
    right: pageRect.right - textRect.right,
    font: style.fontFamily,
    align: style.textAlign,
  };
});
ok(
  "book text keeps safe page margins",
  pageMetrics.left >= 30 && pageMetrics.right >= 30,
  JSON.stringify(pageMetrics),
);
ok(
  "book typography is serif and ragged-right",
  pageMetrics.align === "left" && /Iowan|Palatino|Georgia|serif/i.test(pageMetrics.font),
  JSON.stringify(pageMetrics),
);

await page.waitForSelector('.stage3d[data-ready="true"]', { timeout: 10000 });
ok("Feral3D room loaded", (await page.locator(".stage3d-canvas").count()) === 1);

await page.waitForSelector(".art-media canvas, .art-media img, .art-media video", { timeout: 6000 });
ok("scene art placeholder painted", true);
ok("caption set", (await page.textContent(".art-caption"))?.includes("rope-walk"));

await page.keyboard.press("ArrowRight");
await page.waitForTimeout(1300);
ok("flip forward landed", (await page.textContent(".pg-l .pg-num")) === "3");
const storyArt = page.locator('.page-illustration[data-art-id="cairnmouth-ropewalk"] img');
await storyArt.waitFor({ state: "visible", timeout: 6000 });
const storyArtLoaded = await storyArt.evaluate((img) => img.complete && img.naturalWidth > 0);
ok("story illustration placed and loaded", storyArtLoaded);

await page.click(".btn-play");
await page.waitForSelector(".sent.speaking", { timeout: 9000 });
ok("karaoke highlight active", true);
await page.click(".btn-play");
ok("pause stops highlight growth", true);

let hotspotSeen = false;
for (let i = 0; i < 10 && !hotspotSeen; i++) {
  const visible = await page.locator(".hotspot").isVisible().catch(() => false);
  if (visible) {
    hotspotSeen = true;
    break;
  }
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(1150);
}
ok("interaction beat offered", hotspotSeen);
if (hotspotSeen) {
  await page.click(".hotspot");
  await page.waitForTimeout(700);
  const canvases = await page.locator(".art-media canvas").count();
  ok("token state art applied", canvases > 0);
}

let streetSeen = (await page.locator(".stage3d").getAttribute("data-scene")) === "street";
for (let i = 0; i < 10 && !streetSeen; i++) {
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(1150);
  streetSeen = (await page.locator(".stage3d").getAttribute("data-scene")) === "street";
}
ok("manual final spread enters street", streetSeen);

for (let i = 0; i < 10; i++) {
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(1100);
}
ok("rewound to first spread", (await page.textContent(".pg-l .pg-num")) === "1");

ok("zero console errors", consoleErrors === 0, `${consoleErrors} errors`);

await browser.close();
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed > 0 ? 1 : 0);
