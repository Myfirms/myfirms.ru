// Walks every live page (from url-inventory.csv, junk groups skipped), and
// dumps its Elementor tree as structured JSON: section -> columns -> widgets
// with type, extracted content and the few computed styles we need to rebuild
// the design (background, text colour). Output: extracted/<group>/<slug>.json
// plus extracted/_signatures.txt — one line per section (widget-type
// sequence) to cluster recurring section kinds across pages.
import puppeteer from 'puppeteer-core';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const SKIP = new Set(['em_case_study', 'em_brand']);
const only = process.argv[2]; // optional URL substring filter
const inv = (await readFile('url-inventory.csv', 'utf8')).slice(1).split('\n').slice(1)
  .map((l) => l.match(/"((?:[^"]|"")*)"/g).map((s) => s.slice(1, -1)))
  .filter(([g, u]) => !SKIP.has(g) && (!only || u.includes(only)));

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true, acceptInsecureCerts: true, args: ['--ignore-certificate-errors'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

const sigs = [];
for (const [group, url] of inv) {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
  const data = await page.evaluate(() => {
    const clean = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
    const bg = (el) => {
      const s = getComputedStyle(el);
      // Some sections paint their colour on ::before (Steroids plugin overlays).
      const pb = getComputedStyle(el, '::before');
      const before = pb.content !== 'none' && pb.backgroundColor !== 'rgba(0, 0, 0, 0)' ? pb.backgroundColor : undefined;
      const img = s.backgroundImage.match(/url\("?([^")]+)/)?.[1];
      const ov = el.querySelector(':scope > .elementor-background-overlay');
      const os = ov && getComputedStyle(ov);
      return {
        color: s.backgroundColor !== 'rgba(0, 0, 0, 0)' ? s.backgroundColor : before,
        image: img, gradient: s.backgroundImage.includes('gradient') ? s.backgroundImage : undefined,
        overlay: os && (os.backgroundColor !== 'rgba(0, 0, 0, 0)' || os.backgroundImage !== 'none')
          ? { color: os.backgroundColor, image: os.backgroundImage.slice(0, 200), opacity: os.opacity } : undefined,
      };
    };
    const imgs = (el) => [...el.querySelectorAll('img')].map((i) => ({ src: i.currentSrc || i.src, alt: i.alt || undefined, w: i.naturalWidth, h: i.naturalHeight }))
      .filter((i) => i.src && !i.src.startsWith('data:'));
    const links = (el) => [...el.querySelectorAll('a[href]')].map((a) => ({ text: clean(a.innerText), href: a.getAttribute('href'), cls: [...a.classList].filter((c) => /popmake|button/.test(c)).join(' ') || undefined }));
    const widget = (w) => {
      const type = w.dataset.widget_type;
      const inner = w.querySelector('.elementor-widget-container') ?? w;
      const out = { type, id: w.dataset.id };
      const h = inner.querySelector('h1,h2,h3,h4,h5,h6');
      if (h) out.heading = { tag: h.tagName.toLowerCase(), text: clean(h.innerText) };
      const text = clean(inner.innerText);
      if (text) out.text = text;
      if (/text-editor|icon-list|fancy-list|blockquote|sectiontitle|feature|service|iconbox|image-box|team|counter|progress|interactive-tabs/.test(type)) out.html = inner.innerHTML.replace(/\s+/g, ' ').replace(/<(script|style)[\s\S]*?<\/\1>/g, '').slice(0, 20000);
      const im = imgs(inner); if (im.length) out.images = im;
      const ln = links(inner); if (ln.length) out.links = ln;
      const v = inner.querySelector('iframe,[data-settings*=youtube],video');
      if (v || type?.startsWith('video')) out.video = w.dataset.settings ?? v?.src;
      if (type?.startsWith('shortcode') || type?.includes('contact-form')) out.form = inner.querySelector('.wpcf7')?.id;
      if (type?.startsWith('slides')) out.slides = [...inner.querySelectorAll('.swiper-slide:not(.swiper-slide-duplicate)')].map((s) => ({ bg: bg(s.querySelector('.swiper-slide-bg') ?? s).image, text: clean(s.innerText), html: s.querySelector('.swiper-slide-contents')?.innerHTML.replace(/\s+/g, ' ') }));
      const st = getComputedStyle(inner.querySelector('.elementor-heading-title, p, li, span') ?? inner);
      out.style = { color: st.color, fontSize: st.fontSize, fontWeight: st.fontWeight, fontFamily: st.fontFamily.split(',')[0], align: st.textAlign };
      return out;
    };
    const EL = '.elementor-element, .elementor-column, .elementor-section, .e-con';
    const walk = (el) => {
      if (el.classList.contains('elementor-widget')) return widget(el);
      // Nearest Elementor descendants, regardless of wrapper markup
      // (.elementor-container, .e-con-inner, swiper/glider slider wrappers).
      const kids = [...el.querySelectorAll(EL)].filter((k) => k.parentElement.closest(EL) === el && !k.closest('.swiper-slide-duplicate'));
      const settings = (() => { try { return JSON.parse(el.dataset.settings ?? '{}'); } catch { return {}; } })();
      return {
        type: el.classList.contains('elementor-column') ? 'column' : el.classList.contains('e-con') ? 'container' : 'section',
        id: el.dataset.id, width: Math.round(el.getBoundingClientRect().width), height: Math.round(el.getBoundingClientRect().height),
        bg: bg(el.querySelector(':scope > .elementor-widget-wrap') ?? el),
        slider: settings._ob_glider_is_slider === 'yes' ? (settings._ob_glider_slides_per_view ?? true) : undefined,
        children: kids.map(walk),
      };
    };
    const root = document.querySelector('[data-elementor-type=wp-page], [data-elementor-type=wp-post], [data-elementor-type=single-post], .elementor[data-elementor-type]') ;
    const roots = [...document.querySelectorAll('.elementor[data-elementor-type]')].map((r) => ({ type: r.dataset.elementorType, id: r.dataset.elementorId }));
    const top = root ? [...root.querySelectorAll(':scope > .elementor-section, :scope > .e-con, :scope > .elementor-inner > .elementor-section-wrap > .elementor-section, :scope > .elementor-section-wrap > .elementor-section')] : [];
    // Non-Elementor theme content (portfolio items, archives) — keep the main article HTML.
    const article = !top.length ? document.querySelector('.portfolio-details, .single-portfolio, article, .site-main, main, #primary') : null;
    const banner = document.querySelector('.breatcome-area, .breadcrumb-area, [class*=breatcome]');
    return {
      title: document.title, roots,
      banner: banner && { title: clean(banner.querySelector('h1,h2,h3')?.innerText), crumbs: clean(banner.querySelector('[class*=breadcrumb], ul')?.innerText), bg: bg(banner) },
      sections: top.map(walk),
      article: article && { cls: article.className, html: article.innerHTML.replace(/<(script|style)[\s\S]*?<\/\1>/g, '').replace(/\s+/g, ' ') },
    };
  });
  const slug = decodeURI(new URL(url).pathname).replace(/^\/|\/$/g, '').replace(/\//g, '__') || 'index';
  await mkdir(`extracted/${group}`, { recursive: true });
  await writeFile(`extracted/${group}/${slug}.json`, JSON.stringify({ url, group, ...data }, null, 1));
  const sigOf = (n) => n.children ? (n.type === 'column' ? n.children.map(sigOf).join('+') : `[${n.children.map(sigOf).join(' | ')}]`) : n.type.split('.')[0];
  data.sections.forEach((s, i) => sigs.push(`${sigOf(s)}\t${slug}#${i}`));
  process.stdout.write(`${slug}:${data.sections.length}${data.article ? 'A' : ''} `);
}
await writeFile('extracted/_signatures.txt', sigs.sort().join('\n'));
await browser.close();
