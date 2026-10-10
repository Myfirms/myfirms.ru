// Crawls every URL from the live myfirms.ru Yoast sitemaps, caches raw HTML to
// migration/raw/ and writes the SEO baseline to migration/url-inventory.csv.
// The live certificate is expired, so TLS verification is disabled for this
// read-only crawl only.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'raw');
const ORIGIN = 'https://myfirms.ru';
const SITEMAPS = ['page', 'portfolio', 'portfolio_filter', 'em_case_study', 'em_brand'];

const pick = (html, re) => (html.match(re)?.[1] ?? '').replace(/\s+/g, ' ').trim();
const decode = (s) =>
  s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
const strip = (s) => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const csv = (v) => `"${String(v).replace(/"/g, '""')}"`;
const slugFile = (url) =>
  (decodeURI(new URL(url).pathname).replace(/^\/|\/$/g, '').replace(/[\/\\:*?"<>|]/g, '__') || 'index') + '.html';

async function get(url) {
  const res = await fetch(url, { redirect: 'manual' });
  return { status: res.status, location: res.headers.get('location') ?? '', body: await res.text() };
}

await mkdir(RAW, { recursive: true });
const rows = [];
const imgs = new Set();

for (const sm of SITEMAPS) {
  const { body } = await get(`${ORIGIN}/${sm}-sitemap.xml`);
  const urls = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => !u.includes('/wp-content/'));
  for (const url of urls) {
    const r = await get(url);
    const h = r.body;
    await writeFile(join(RAW, sm, slugFile(url)).replace(/(raw[\\/][^\\/]+)[\\/]/, '$1/'), h, { flag: 'w' }).catch(async () => {
      await mkdir(join(RAW, sm), { recursive: true });
      await writeFile(join(RAW, sm, slugFile(url)), h);
    });
    for (const m of h.matchAll(/(?:src|data-src|srcset|href)=["']([^"']*\/wp-content\/uploads\/[^"'\s]+)/g)) imgs.add(m[1].split(' ')[0]);
    for (const m of h.matchAll(/url\(['"]?([^'")]*\/wp-content\/uploads\/[^'")]+)/g)) imgs.add(m[1]);
    rows.push({
      group: sm,
      url,
      status: r.status,
      location: r.location,
      title: decode(pick(h, /<title[^>]*>([\s\S]*?)<\/title>/i)),
      description: decode(pick(h, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)),
      canonical: pick(h, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)/i),
      robots: pick(h, /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)/i),
      h1: strip(pick(h, /<h1[^>]*>([\s\S]*?)<\/h1>/i)),
      h1count: (h.match(/<h1[\s>]/gi) ?? []).length,
      words: strip(pick(h, /<body[^>]*>([\s\S]*)<\/body>/i).replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')).split(' ').length,
    });
    process.stdout.write('.');
  }
}

const cols = ['group', 'url', 'status', 'location', 'title', 'description', 'canonical', 'robots', 'h1', 'h1count', 'words'];
await writeFile(join(ROOT, 'url-inventory.csv'), '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => csv(r[c])).join(','))].join('\n'));
await writeFile(join(ROOT, 'uploads-referenced.txt'), [...imgs].sort().join('\n'));

const by = (k) => Object.entries(rows.reduce((a, r) => ((a[r[k]] = (a[r[k]] ?? 0) + 1), a), {}));
console.log(`\n${rows.length} URLs; status:`, by('status'), '; groups:', by('group'));
console.log('no description:', rows.filter((r) => !r.description).length, '| h1!=1:', rows.filter((r) => r.h1count !== 1).length, '| noindex:', rows.filter((r) => /noindex/.test(r.robots)).length);
console.log('referenced uploads:', imgs.size);
