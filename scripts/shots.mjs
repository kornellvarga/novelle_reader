import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { browserExecutable } from "./browser-path.mjs";

const BASE = process.env.SMOKE_URL ?? "http://127.0.0.1:4180/";
mkdirSync("docs/screenshots", { recursive: true });

const browser = await chromium.launch({ executablePath: browserExecutable(), headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(`${BASE}?voice=0&rate=3`, { waitUntil: "networkidle" });
await page.evaluate(() => window.localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.screenshot({ path: "docs/screenshots/01-age-gate.png" });

await page.click("text=I'M 18+");
await page.waitForSelector(".cover-screen");
await page.waitForTimeout(600);
await page.screenshot({ path: "docs/screenshots/02-cover.png" });

await page.locator(".chapter-item").first().click();
await page.waitForSelector(".art-media canvas");
await page.waitForTimeout(900);
await page.screenshot({ path: "docs/screenshots/03-reading.png" });

await page.click(".btn-play");
await page.waitForSelector(".sent.speaking", { timeout: 20000 });
await page.waitForFunction(() => document.querySelector(".bubble")?.style.display !== "none", undefined, {
  timeout: 25000,
});
await page.click(".btn-play");
await page.waitForTimeout(250);
await page.screenshot({ path: "docs/screenshots/04-voice-bubble-highlight.png" });

let seen = false;
for (let i = 0; i < 8 && !seen; i++) {
  seen = await page.locator(".hotspot").isVisible().catch(() => false);
  if (!seen) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(1150);
  }
}
if (seen) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: "docs/screenshots/05-hotspot.png" });
  await page.click(".hotspot");
  await page.waitForTimeout(800);
  await page.screenshot({ path: "docs/screenshots/06-token-state.png" });
}

await browser.close();
console.log("screenshots written to docs/screenshots/");
