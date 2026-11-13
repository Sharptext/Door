// Regenerates the raster brand assets from the logo component:
//   favicon.ico (16 + 32), apple-touch-icon.png (180), icon-192.png, icon-512.png, og-image.png (1200x630)
// Usage, from the repo root:  node tools/render-brand-assets.mjs
// Needs Playwright (Chromium), Python 3 with Pillow (for the .ico), and network access to Google Fonts.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const css = path.join(root, 'assets/brand/st-logo.css');
const js = path.join(root, 'assets/brand/st-logo.js');
const FONTS = 'https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@600&display=swap';

const browser = await chromium.launch();

async function render(html, size, out) {
  const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html class="js"><head>
    <link rel="stylesheet" href="${FONTS}">
    <style>html,body{margin:0;width:${size.width}px;height:${size.height}px;overflow:hidden}</style>
    </head><body>${html}</body></html>`);
  await page.addStyleTag({ path: css });
  await page.addScriptTag({ path: js });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.querySelectorAll('st-logo')].every(e => e.querySelector('svg')));
  await page.screenshot({ path: out, omitBackground: false });
  await page.close();
}

// App icon tile: symbol in the dark colours, ~70% of a #16191D square.
const tile = (px) => `<div style="width:${px}px;height:${px}px;background:#16191D;display:flex;align-items:center;justify-content:center">
  <st-logo class="st-logo st-logo--dark" variant="symbol" style="font-size:${(px * 0.7) / 1.1}px"></st-logo></div>`;

const tmp = mkdtempSync(path.join(tmpdir(), 'st-icons-'));
for (const [px, file] of [[180, 'apple-touch-icon.png'], [192, 'icon-192.png'], [512, 'icon-512.png']]) {
  await render(tile(px), { width: px, height: px }, path.join(root, file));
}
for (const px of [16, 32, 256]) await render(tile(px), { width: px, height: px }, path.join(tmp, `ico-${px}.png`));

// Open Graph: lockup centred on white, wordmark 120px.
await render(
  `<div style="width:1200px;height:630px;background:#FFFFFF;display:flex;align-items:center;justify-content:center">
     <st-logo class="st-logo" style="font-size:120px"><span class="st-logo__word">sharptext</span></st-logo></div>`,
  { width: 1200, height: 630 }, path.join(root, 'og-image.png'));

await browser.close();

// favicon.ico with 16 and 32 px frames, each rendered natively at its size.
execFileSync('python3', ['-I', '-c', `
import sys
from PIL import Image
a, b, out = sys.argv[1:4]
Image.open(b).convert('RGBA').save(out, format='ICO', sizes=[(16,16),(32,32)], append_images=[Image.open(a).convert('RGBA')])
`, path.join(tmp, 'ico-16.png'), path.join(tmp, 'ico-32.png'), path.join(root, 'favicon.ico')]);
rmSync(tmp, { recursive: true, force: true });
console.log('Brand assets written.');
