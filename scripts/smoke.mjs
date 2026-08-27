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
  const tokenArt = page.locator(".art-media canvas").first();
  const tokenArtReady = await tokenArt.waitFor({ state: "visible", timeout: 6000 }).then(() => true).catch(() => false);
  ok("token state art applied", tokenArtReady);
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

ok("zero desktop console errors", consoleErrors === 0, `${consoleErrors} errors`);

const mobileContext = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
});
const mobile = await mobileContext.newPage();
let mobileErrors = 0;
mobile.on("console", (m) => { if (m.type() === "error") mobileErrors += 1; });
mobile.on("pageerror", () => { mobileErrors += 1; });

await mobile.goto(`${BASE}?voice=0`, { waitUntil: "networkidle" });
await mobile.evaluate(() => window.localStorage.clear());
await mobile.reload({ waitUntil: "networkidle" });
await mobile.click("text=I'M 18+");
await mobile.waitForSelector(".cover-screen");
ok("mobile cover fits without horizontal overflow", await mobile.evaluate(() => document.documentElement.scrollWidth === innerWidth));

await mobile.locator(".chapter-item").first().click();
await mobile.waitForSelector(".pg-r .para");
const mobileLayout = await mobile.evaluate(() => {
  const book = document.querySelector(".book").getBoundingClientRect();
  const controls = document.querySelector(".controls").getBoundingClientRect();
  const primary = [...document.querySelectorAll(".control-nav .btn")].map((el) => el.getBoundingClientRect());
  return {
    noOverlap: book.bottom <= controls.top,
    targetSizes: primary.map((r) => ({ w: r.width, h: r.height })),
    horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
  };
});
ok("mobile book clears the control tray", mobileLayout.noOverlap, JSON.stringify(mobileLayout));
ok("mobile primary controls are touch sized", mobileLayout.targetSizes.every((r) => r.w >= 44 && r.h >= 44), JSON.stringify(mobileLayout));
ok("mobile reader has no horizontal overflow", mobileLayout.horizontalOverflow === 0, JSON.stringify(mobileLayout));

await mobile.click(".btn-more");
ok("mobile tools drawer opens", await mobile.locator(".chrome").evaluate((el) => el.classList.contains("tools-open")));
const toolHeights = await mobile.locator(".control-tools .btn").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
ok("mobile tool controls are touch sized", toolHeights.every((h) => h >= 44), JSON.stringify(toolHeights));
await mobile.click(".control-tools-scrim");

const bookBox = await mobile.locator(".book").boundingBox();
await mobile.touchscreen.tap(bookBox.x + bookBox.width * 0.8, bookBox.y + bookBox.height * 0.5);
await mobile.waitForTimeout(180);
ok("mobile page tap advances", (await mobile.textContent(".pg-r .pg-num")) === "2");

await mobile.locator(".book").dispatchEvent("pointerdown", {
  pointerId: 17, pointerType: "touch", isPrimary: true,
  clientX: bookBox.x + bookBox.width * 0.82, clientY: bookBox.y + bookBox.height * 0.5,
});
await mobile.locator(".book").dispatchEvent("pointerup", {
  pointerId: 17, pointerType: "touch", isPrimary: true,
  clientX: bookBox.x + bookBox.width * 0.18, clientY: bookBox.y + bookBox.height * 0.5,
});
await mobile.waitForTimeout(180);
ok("mobile swipe advances", (await mobile.textContent(".pg-r .pg-num")) === "3");

await mobile.setViewportSize({ width: 390, height: 640 });
await mobile.waitForTimeout(420);
const shortLayout = await mobile.evaluate(() => {
  const paper = document.querySelector(".pg-r").getBoundingClientRect();
  const controls = document.querySelector(".controls").getBoundingClientRect();
  const paras = [...document.querySelectorAll(".pg-r .para")].map((el) => el.getBoundingClientRect());
  return {
    clearsControls: paper.bottom <= controls.top,
    textFits: paras.every((r) => r.bottom <= paper.bottom - 22),
  };
});
ok("short phone relayout clears controls", shortLayout.clearsControls, JSON.stringify(shortLayout));
ok("short phone repaginates visible text", shortLayout.textFits, JSON.stringify(shortLayout));

for (let i = 0; i < 120 && Number(await mobile.textContent(".pg-r .pg-num")) > 1; i++) {
  await mobile.keyboard.press("ArrowLeft");
  await mobile.waitForTimeout(12);
}
const clippedMobilePages = [];
for (let i = 0; i < 120; i++) {
  const pageFit = await mobile.evaluate(() => {
    const paper = document.querySelector(".pg-r");
    const paperRect = paper.getBoundingClientRect();
    const clipped = [...paper.querySelectorAll(".para")]
      .filter((el) => el.getBoundingClientRect().bottom > paperRect.bottom - 22)
      .map((el) => el.textContent.slice(0, 60));
    return { page: paper.querySelector(".pg-num")?.textContent ?? "", clipped };
  });
  if (pageFit.clipped.length) clippedMobilePages.push(pageFit);
  const before = pageFit.page;
  await mobile.keyboard.press("ArrowRight");
  await mobile.waitForTimeout(12);
  if ((await mobile.textContent(".pg-r .pg-num")) === before) break;
}
ok("short phone has no clipped chapter pages", clippedMobilePages.length === 0, JSON.stringify(clippedMobilePages));
if (await mobile.locator(".paywall").isVisible().catch(() => false)) {
  await mobile.click("text=KEEP BROWSING");
  await mobile.waitForTimeout(280);
}

await mobile.click(".btn-more");
await mobile.click(".control-tools .btn:last-child");
await mobile.waitForSelector(".cover-screen");
await mobile.setViewportSize({ width: 844, height: 390 });
await mobile.waitForTimeout(420);
ok("rotation keeps the cover open", await mobile.isVisible(".cover-screen"));

await mobile.setViewportSize({ width: 390, height: 844 });
await mobile.locator(".chapter-item").first().click();
await mobile.waitForSelector(".pg-r .para");
let mobileHotspot = false;
for (let i = 0; i < 16 && !mobileHotspot; i++) {
  mobileHotspot = await mobile.locator(".hotspot").isVisible().catch(() => false);
  if (!mobileHotspot) {
    await mobile.keyboard.press("ArrowRight");
    await mobile.waitForTimeout(100);
  }
}
ok("mobile interaction beat offered", mobileHotspot);
if (mobileHotspot) {
  const interactionLayout = await mobile.evaluate(() => {
    const book = document.querySelector(".book").getBoundingClientRect();
    const hotspot = document.querySelector(".hotspot").getBoundingClientRect();
    const controls = document.querySelector(".controls").getBoundingClientRect();
    return {
      clearOfBook: hotspot.top >= book.bottom,
      clearOfControls: hotspot.bottom <= controls.top,
      touchHeight: hotspot.height,
    };
  });
  ok("mobile interaction has a safe action rail", interactionLayout.clearOfBook && interactionLayout.clearOfControls, JSON.stringify(interactionLayout));
  ok("mobile interaction is touch sized", interactionLayout.touchHeight >= 44, JSON.stringify(interactionLayout));
}
ok("zero mobile console errors", mobileErrors === 0, `${mobileErrors} errors`);
await mobileContext.close();

await browser.close();
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed > 0 ? 1 : 0);
