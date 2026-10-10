// Downloads every image referenced by extracted/*.json (widget images, section
// and slide backgrounds, banner backgrounds) into ../src/assets/wp/<yyyy>/<mm>/.
// WordPress size variants (-1024x683) are swapped for the original upload when
// it exists, so astro:assets can generate its own responsive sizes.
// Writes extracted/_media-map.json: original URL -> local asset path.
import { mkdir, readdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const OUT = '../src/assets/wp';
const urls = new Set();
const collect = (v) => {
  if (typeof v === 'string') { for (const m of v.matchAll(/https?:\/\/myfirms\.ru\/wp-content\/uploads\/[^"')\s]+?\.(?:jpe?g|png|webp|gif|svg)/gi)) urls.add(m[0].replace(/^http:/, 'https:')); return; }
  if (v && typeof v === 'object') Object.values(v).forEach(collect);
};
for (const g of await readdir('extracted')) {
  if (g.startsWith('_')) continue;
  for (const f of await readdir(`extracted/${g}`)) collect(JSON.parse(await readFile(`extracted/${g}/${f}`, 'utf8')));
}

// Portfolio covers live only in <meta og:image>.
for (const f of await readdir('raw/portfolio')) { const og = (await readFile(`raw/portfolio/${f}`, 'utf8')).match(/<meta property="og:image" content="([^"]+)"/)?.[1]; if (og) urls.add(og.replace(/^http:/, 'https:')); }

const exists = (p) => access(p).then(() => true, () => false);
const head = async (u) => (await fetch(u, { method: 'HEAD' })).ok;
const map = {};
let n = 0, bytes = 0, failed = [];
for (const u of [...urls].sort()) {
  const original = u.replace(/-\d+x\d+(\.\w+)$/, '$1');
  const src = original !== u && (await head(original)) ? original : u;
  const rel = decodeURIComponent(new URL(src).pathname.replace('/wp-content/uploads/', ''));
  const dest = join(OUT, rel);
  if (!(await exists(dest))) {
    const res = await fetch(src);
    if (!res.ok) { failed.push(src); continue; }
    const buf = Buffer.from(await res.arrayBuffer());
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, buf);
    bytes += buf.length; n++;
  }
  map[u] = `wp/${rel}`;
}
await writeFile('extracted/_media-map.json', JSON.stringify(map, null, 1));
console.log(`refs ${urls.size}, downloaded ${n} (${(bytes / 1e6).toFixed(1)} MB), failed ${failed.length}`, failed.slice(0, 5));
