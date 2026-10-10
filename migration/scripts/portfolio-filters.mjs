// Collects portfolio category membership from the live filter archives
// (portfolio items themselves don't carry their category in the markup).
// Output: extracted/_portfolio-filters.json { slug: { name, items: [itemSlug] } }
import puppeteer from 'puppeteer-core';
import { writeFile } from 'node:fs/promises';

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, acceptInsecureCerts: true, args: ['--ignore-certificate-errors'] });
const page = await browser.newPage();
await page.goto('https://myfirms.ru/portfolio/', { waitUntil: 'networkidle2', timeout: 90000 });
const filters = await page.evaluate(() => [...document.querySelectorAll('a[href*="/portfolio_filter/"]')].map((a) => ({ name: a.innerText.trim(), href: a.href })).filter((f, i, all) => f.name && all.findIndex((x) => x.href === f.href) === i));
const out = {};
const slugOf = (u) => decodeURIComponent(new URL(u).pathname).split('/').filter(Boolean).pop();
for (const [order, f] of filters.entries()) {
  const items = new Set();
  for (let p = 1; p < 10; p++) {
    const url = p === 1 ? f.href : `${f.href}page/${p}/`;
    const res = await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
    if (!res.ok()) break;
    const found = await page.evaluate(() => [...document.querySelectorAll('a[href*="/portfolio-item/"]')].map((a) => a.href));
    const before = items.size;
    found.forEach((u) => items.add(slugOf(u)));
    if (items.size === before) break;
  }
  out[slugOf(f.href)] = { name: f.name, order, items: [...items] };
  console.log(slugOf(f.href), f.name, items.size);
}
await writeFile('extracted/_portfolio-filters.json', JSON.stringify(out, null, 1));
await browser.close();
