/**
 * Graba un MP4 de la landing en /. Requiere `npm run dev` corriendo en :3000.
 *
 *   node scripts/record-landing.mjs
 *
 * Output: recordings/landing.mp4 (+ landing.webm intermedio mientras se transcodifica).
 */

import { chromium } from "playwright";
import { mkdir, rm, readdir, rename } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const RECORDINGS_DIR = path.join(ROOT, "recordings");
const TARGET_URL = process.env.RECORD_URL ?? "http://localhost:3000";
const VIEWPORT = { width: 1280, height: 800 };
const OUTPUT_NAME = process.env.RECORD_NAME ?? "landing";

async function smoothScroll(page, totalPx, durationMs) {
  await page.evaluate(
    ({ totalPx, durationMs }) => {
      return new Promise((resolve) => {
        const startY = window.scrollY;
        const startedAt = performance.now();
        const tick = (now) => {
          const elapsed = now - startedAt;
          const t = Math.min(1, elapsed / durationMs);
          // easeInOutCubic
          const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
          window.scrollTo({ top: startY + totalPx * eased, behavior: "instant" });
          if (t < 1) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
    },
    { totalPx, durationMs }
  );
}

async function main() {
  await mkdir(RECORDINGS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    recordVideo: { dir: RECORDINGS_DIR, size: VIEWPORT },
  });
  const page = await context.newPage();

  console.log(`▶ navegando a ${TARGET_URL}`);
  await page.goto(TARGET_URL, { waitUntil: "networkidle", timeout: 30_000 });

  // Esperar que paren animaciones iniciales y haya un primer paint útil.
  await page.waitForTimeout(2500);

  // Documento completo
  const documentHeight = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight
  );
  console.log(`▶ scrollable: ${documentHeight}px`);

  // Si hay mucho contenido scrolleamos en 8s, si no, solo nos quedamos arriba.
  if (documentHeight > 200) {
    await smoothScroll(page, documentHeight, 8000);
    await page.waitForTimeout(1000);
    await smoothScroll(page, -documentHeight, 3000);
  } else {
    await page.waitForTimeout(8000);
  }

  await page.waitForTimeout(800);

  const video = page.video();
  await context.close();
  await browser.close();

  if (!video) {
    throw new Error("Playwright no devolvió un video handle.");
  }

  const tempPath = await video.path();
  const webmPath = path.join(RECORDINGS_DIR, `${OUTPUT_NAME}.webm`);
  await rename(tempPath, webmPath);
  console.log(`✓ webm guardado: ${webmPath}`);

  // Transcode a MP4 si tenemos ffmpeg.
  const mp4Path = path.join(RECORDINGS_DIR, `${OUTPUT_NAME}.mp4`);
  console.log(`▶ transcoding a mp4 (h264) …`);
  await execFileAsync("ffmpeg", [
    "-y",
    "-i", webmPath,
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-crf", "20",
    "-preset", "medium",
    "-movflags", "+faststart",
    mp4Path,
  ]);
  console.log(`✓ mp4 guardado: ${mp4Path}`);

  // Limpia restos del directorio temporal de playwright
  try {
    const entries = await readdir(RECORDINGS_DIR);
    for (const entry of entries) {
      if (entry.endsWith(".webm") && entry !== `${OUTPUT_NAME}.webm`) {
        await rm(path.join(RECORDINGS_DIR, entry), { force: true });
      }
    }
  } catch {}
}

main().catch((err) => {
  console.error("✗ recording failed:", err);
  process.exit(1);
});
