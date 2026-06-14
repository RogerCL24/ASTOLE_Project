/**
 * Rasteriza frontend/app/icon.svg a PNGs usando Chromium headless (Playwright).
 *
 *   node scripts/rasterize-icon.mjs
 *
 * Output:
 *   frontend/app/apple-icon.png   (180x180, fondo transparente)
 *   frontend/public/icon-512.png  (512x512, master)
 */

import { chromium } from "playwright";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const SVG_PATH = path.join(ROOT, "app", "icon.svg");

const TARGETS = [
  { size: 180, out: path.join(ROOT, "app", "apple-icon.png") },
  { size: 512, out: path.join(ROOT, "public", "icon-512.png") },
];

async function renderAt(browser, svgMarkup, size) {
  const context = await browser.newContext({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const html = `<!doctype html><html><head><style>
    html,body{margin:0;padding:0;background:transparent;}
    svg{display:block;width:${size}px;height:${size}px;}
  </style></head><body>${svgMarkup}</body></html>`;
  await page.setContent(html, { waitUntil: "load" });
  const png = await page.screenshot({ omitBackground: true, type: "png" });
  await context.close();
  return png;
}

async function main() {
  const svgMarkup = await readFile(SVG_PATH, "utf-8");
  const browser = await chromium.launch({ headless: true });
  try {
    for (const { size, out } of TARGETS) {
      const buf = await renderAt(browser, svgMarkup, size);
      await writeFile(out, buf);
      console.log(`✓ ${out}  (${size}x${size}, ${(buf.length / 1024).toFixed(1)} KB)`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("✗ rasterize failed:", e);
  process.exit(1);
});
