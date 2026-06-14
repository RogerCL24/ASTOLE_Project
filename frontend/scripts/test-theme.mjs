import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();

await page.goto("http://localhost:3000/telemetria", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

const before = await page.evaluate(() => ({
  htmlClass: document.documentElement.className,
  bodyBg: getComputedStyle(document.body).backgroundColor,
  bodyColor: getComputedStyle(document.body).color,
  buttonExists: !!document.querySelector('[aria-label^="Cambiar a modo"]'),
  buttonLabel: document.querySelector('[aria-label^="Cambiar a modo"]')?.getAttribute("aria-label"),
}));
console.log("BEFORE:", JSON.stringify(before, null, 2));

await page.screenshot({ path: "recordings/theme-before.png" });

await page.click('[aria-label^="Cambiar a modo"]');
await page.waitForTimeout(800);

const after = await page.evaluate(() => ({
  htmlClass: document.documentElement.className,
  bodyBg: getComputedStyle(document.body).backgroundColor,
  bodyColor: getComputedStyle(document.body).color,
  storedTheme: localStorage.getItem("astole.theme"),
  buttonLabel: document.querySelector('[aria-label^="Cambiar a modo"]')?.getAttribute("aria-label"),
}));
console.log("AFTER click:", JSON.stringify(after, null, 2));

await page.screenshot({ path: "recordings/theme-after.png" });

await browser.close();
