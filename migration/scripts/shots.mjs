// Full-page screenshots of the live site via the locally installed Edge.
// Usage: node scripts/shots.mjs [desktop|mobile] path1 path2 ...
// Output: raw/shots/<viewport>/<name>.jpg (downscaled for cheap review).
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const [vp = 'desktop', ...paths] = process.argv.slice(2);
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } };
const ORIGIN = process.env.ORIGIN ?? 'https://myfirms.ru';
const outDir = `raw/shots/${process.env.ORIGIN ? 'new-' : ''}${vp}`;
await mkdir(outDir, { recursive: true });

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, acceptInsecureCerts: true, args: ['--ignore-certificate-errors'] });
const page = await browser.newPage();
await page.setViewport(VIEWPORTS[vp]);
for (const p of paths) {
  await page.goto(ORIGIN + p, { waitUntil: 'networkidle2', timeout: 90000 });
  // trigger lazy-load / scroll animations
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 350)); }
    window.scrollTo(0, 0);
  });
  await new Promise((r) => setTimeout(r, 1500));
  const buf = await page.screenshot({ fullPage: true });
  const name = (p.replace(/^\/|\/$/g, '').replace(/\//g, '__') || 'index');
  const meta = await sharp(buf).metadata();
  // split tall pages into chunks so each image stays readable when downscaled
  const chunk = vp === 'desktop' ? 2400 : 2400;
  for (let i = 0, top = 0; top < meta.height; i++, top += chunk) {
    const h = Math.min(chunk, meta.height - top);
    await sharp(buf).extract({ left: 0, top, width: meta.width, height: h })
      .resize({ width: vp === 'desktop' ? 960 : 390 }).jpeg({ quality: 70 })
      .toFile(`${outDir}/${name}.${i}.jpg`);
  }
  console.log(name, meta.width + 'x' + meta.height);
}
await browser.close();
