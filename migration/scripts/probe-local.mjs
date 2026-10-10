// probe.mjs against the local preview: node scripts/probe-local.mjs /path/ "<expr>" [width]
import puppeteer from 'puppeteer-core';
const [path, expr, width = '1440'] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const page = await browser.newPage();
await page.setViewport({ width: +width, height: 900 });
await page.goto((process.env.ORIGIN ?? 'http://localhost:4322') + path, { waitUntil: 'networkidle2', timeout: 90000 });
console.log(JSON.stringify(await page.evaluate(`(async () => (${expr}))()`), null, 1));
await browser.close();
