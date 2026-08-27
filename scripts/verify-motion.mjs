import { chromium } from "playwright-core";
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:4180/?voice=0", { waitUntil: "networkidle" });
await page.evaluate(() => window.localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.click("text=I'M 18+");
await page.locator(".chapter-item").first().click();
await page.waitForSelector(".art-media video", { timeout: 10000 });
const info = await page.evaluate(() => {
  const v = document.querySelector(".art-media video");
  return { tag: "VIDEO", src: v.currentSrc.split("/").pop(), w: v.videoWidth, h: v.videoHeight, duration: v.duration, playing: !v.paused };
});
console.log(JSON.stringify(info));
await page.waitForTimeout(2500);
await page.screenshot({ path: "docs/screenshots/07-motion-scene.png" });
await browser.close();
