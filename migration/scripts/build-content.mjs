// Converts extracted/*.json (Elementor dump of the live site) into the Astro
// content collections under ../src/content/: pages, portfolio,
// portfolioFilters, team. Writes extracted/_report.md listing every fix and
// everything that needs a human decision.
//
// Re-runnable: overwrites generated files. SEO titles/descriptions are NOT
// generated here — they are merged from ../src/content/_seo.json if present
// (hand-written), otherwise the WP <title> is used as a placeholder.
import { mkdir, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const OUT = '../src/content';
const media = JSON.parse(await readFile('extracted/_media-map.json', 'utf8'));
const filtersRaw = JSON.parse(await readFile('extracted/_portfolio-filters.json', 'utf8'));
const seoOverrides = existsSync(`${OUT}/_seo.json`) ? JSON.parse(await readFile(`${OUT}/_seo.json`, 'utf8')) : {};
const report = { fixes: [], todo: [], unknown: [] };
const note = (kind, page, msg) => report[kind].push(`${page}: ${msg}`);

// ---------- helpers ----------
const ORIGIN = 'https://myfirms.ru';
const LINK_FIXES = { '/veb-analitika/': '/marketing/veb-analitika/' };
const asset = (url) => {
  if (!url) return undefined;
  const u = url.replace(/^http:/, 'https:').replace(/^\/\//, 'https://');
  return media[u] ?? media[u.replace(/-\d+x\d+(\.\w+)$/, '$1')];
};
const DECOR = /(^|\/)(shape[\w-]*|round\d*|feature-shape[\w-]*|contact-shape\d*|strelka[\w-]*|klipartz[\w.-]*|dummy|11|2020|42dl877|line[\w-]*)\.(png|jpe?g|svg)$/i;
const isDecor = (src) => DECOR.test(src.split('?')[0]);
const decode = (s) => s.replace(/&nbsp;/g, ' ').replace(/&#8212;/g, '—').replace(/&laquo;/g, '«').replace(/&raquo;/g, '»').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#8220;|&#8221;/g, '"').replace(/&#8230;/g, '…');
const strip = (h) => decode((h ?? '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
/** Sentence-case text the WP site rendered uppercase only via CSS is already
 * stored in its source case in widget HTML; innerText gives the uppercased
 * version. Always prefer HTML-derived text. */
const headingFromHtml = (html) => [...(html ?? '').matchAll(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => ({ tag: m[1], text: strip(m[2]) })).filter((h) => h.text);
const normHref = (page, href) => {
  if (!href || href === '#' || href.startsWith('javascript')) return undefined;
  let h = href.replace(/^https?:\/\/myfirms\.ru/, '') || '/';
  if (h.startsWith('/') && !h.endsWith('/') && !/\.\w+$/.test(h) && !h.includes('#') && !h.includes('?')) { h += '/'; }
  if (LINK_FIXES[h]) { note('fixes', page, `ссылка ${h} → ${LINK_FIXES[h]}`); h = LINK_FIXES[h]; }
  if (/^http:\/\/[А-я]/.test(href)) { note('fixes', page, `битая ссылка ${href} удалена`); return undefined; }
  return h;
};
/** Keep a small, clean subset of the WP rich-text markup. */
const cleanHtml = (page, html) => {
  let h = (html ?? '')
    .replace(/<(script|style|link|svg)[\s\S]*?(<\/\1>|\/?>)/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, inner) => {
      const n = normHref(page, decode(href));
      return n ? `<a href="${n}">${inner}</a>` : inner;
    })
    .replace(/<(\/?)(b|strong)\b[^>]*>/gi, '<$1strong>')
    .replace(/<(\/?)(i|em)\b(?![^>]*class="(fa|flaticon|e-font))[^>]*>/gi, '<$1em>')
    .replace(/<(?!\/?(p|ul|ol|li|a|strong|em|br|h2|h3|h4)\b)[^>]+>/gi, '')
    .replace(/<(p|ul|ol|li|h2|h3|h4)\s[^>]*>/gi, '<$1>')
    .replace(/<p>\s*(&nbsp;)?\s*<\/p>/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/> </g, '><')
    .trim();
  return decode(h);
};
const BG = (bg, page) => {
  if (!bg) return 'lavender';
  const img = bg.image?.split('/').pop();
  const map = { '02.jpg': 'pattern-pink', 'about-bg2.png': 'contact', 'skill-bg.jpg': 'glow-dark', 'contact-bg.png': 'shape-sky', '000.png': 'pattern-white', 'techno-4.jpg': 'shape-gray' };
  if (img && map[img]) return map[img];
  if (img) note('todo', page, `неизвестный фон ${img}`);
  const c = { 'rgb(255, 255, 255)': 'white', 'rgb(245, 245, 245)': 'gray', 'rgb(254, 245, 243)': 'pink', 'rgb(250, 247, 247)': 'sand', 'rgb(237, 44, 65)': 'accent' }[bg.color];
  if (c) return c;
  if (bg.color) note('todo', page, `неизвестный цвет фона ${bg.color}`);
  return 'lavender'; // transparent sections show the body colour on the WP site
};
const youtubeId = (settings) => {
  const s = typeof settings === 'string' ? settings : JSON.stringify(settings ?? '');
  return s.replace(/\\\//g, '/').match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/)?.[1];
};
const ICONS = { 'chat-1': 'messages-square', 'money-2': 'wallet', 'money': 'wallet', mail: 'mail', map: 'map-pin', growth: 'trending-up', 'light-bulb': 'lightbulb', 'pin-2': 'map-pin' };
const iconName = (html) => {
  const m = html?.match(/flaticon-([\w-]+)/)?.[1] ?? html?.match(/e-fas-([\w-]+)/)?.[1];
  return m ? (ICONS[m] ?? m) : undefined;
};

// ---------- widget conversion ----------
const typeOf = (w) => w.type.split('.')[0];
const FORM_TYPES = new Set(['shortcode', 'bdt-contact-form-7']);

function convertWidget(page, w) {
  const t = typeOf(w);
  switch (t) {
    case 'spacer': case 'divider': return null;
    case 'sectiontitle': case 'heading': {
      const hs = w.html ? headingFromHtml(w.html) : w.heading ? [{ tag: w.heading.tag, text: w.heading.text }] : [];
      const paras = (w.html ?? '').match(/<p[\s\S]*?<\/p>/g)?.join('') ?? '';
      const align = /t_center|text-center/.test(w.html ?? '') || w.style?.align === 'center' ? 'center' : 'left';
      const onDark = /rgb\(255, 255, 255\)/.test(w.style?.color ?? '');
      if (!hs.length) {
        const text = w.html ? cleanHtml(page, paras || w.html) : w.text;
        return text ? { kind: 'text', html: w.html ? text : `<p>${text}</p>`, onDark } : null;
      }
      const eyebrow = hs.length > 1 && /h[56]/.test(hs[0].tag) ? hs.shift().text : undefined;
      return { kind: 'title', text: hs.map((h) => h.text).join(' '), level: 'h2', ...(eyebrow && { eyebrow }), ...(paras && { lead: cleanHtml(page, paras) }), align, onDark };
    }
    case 'text-editor': {
      const html = cleanHtml(page, w.html);
      return html ? { kind: 'text', html: /^<(p|ul|ol|h\d)/.test(html) ? html : `<p>${html}</p>`, onDark: /rgb\(255, 255, 255\)|#ffffff/i.test(w.html ?? '') } : null;
    }
    case 'dit-button': case 'button': {
      const l = w.links?.[0];
      const label = (l?.text || w.text || '').replace(/arrow_right_alt/g, '').trim();
      if (!label) return null;
      const href = normHref(page, l?.href);
      if (!href && l?.href === '#') note('fixes', page, `кнопка «${label}» (href="#") → открывает форму заявки`);
      return { kind: 'button', link: { label, ...(href && { href }) }, variant: 'primary' };
    }
    case 'image': {
      const img = w.images?.[0];
      if (!img) return null;
      const src = asset(img.src);
      if (!src) { note('todo', page, `картинка не скачана ${img.src}`); return null; }
      // Decorative theme shapes (floating balls, arrows) are dropped: they were absolutely
      // positioned overlays in Elementor and break the column grouping below.
      if (isDecor(img.src)) return null;
      return { kind: 'image', src, alt: img.alt ?? '', rounded: true, decorative: false };
    }
    case 'image-carousel': {
      const seen = new Set();
      const images = (w.images ?? []).map((i) => asset(i.src)).filter((s) => s && !seen.has(s) && seen.add(s)).map((src) => ({ src, alt: '' }));
      const logos = (w.images ?? []).every((i) => i.h && i.h <= 120);
      return images.length ? { kind: 'carousel', images, logos } : null;
    }
    case 'feature': case 'iconbox': case 'image-box': case 'service': case 'counter': case 'progress': case 'team':
      return { kind: `_${t}`, raw: w }; // grouped later
    case 'icon-list': case 'bdt-fancy-list': {
      const items = [...(w.html ?? '').matchAll(/<li[\s\S]*?<\/li>/g)].map((m) => {
        const href = normHref(page, m[0].match(/href="([^"]*)"/)?.[1]);
        return { text: strip(m[0]), ...(href && { href }) };
      }).filter((i) => i.text);
      const icon = /check/.test(w.html ?? '') ? 'check' : /pin|map/.test(w.html ?? '') ? 'pin' : 'dot';
      return items.length ? { kind: 'list', icon, items } : null;
    }
    case 'blockquote': return { kind: 'quote', text: strip(w.html) };
    case 'video': {
      const id = youtubeId(w.video);
      if (!id) { note('todo', page, `видео без YouTube ID: ${String(w.video).slice(0, 80)}`); return null; }
      return { kind: 'video', youtubeId: id };
    }
    case 'bdt-interactive-tabs': {
      const titles = [...(w.html ?? '').matchAll(/bdt-interactive-tabs-title[^>]*>([\s\S]*?)<\/(h\d|div|span)>/g)].map((m) => strip(m[1]));
      const texts = [...(w.html ?? '').matchAll(/bdt-interactive-tabs-sub-title[^>]*>([\s\S]*?)<\/(h\d|div|span|p)>/g)].map((m) => strip(m[1]));
      if (!titles.length) { note('unknown', page, `interactive-tabs не разобран`); return null; }
      return { kind: 'tabs', items: titles.map((title, i) => ({ title, html: texts[i] ? `<p>${texts[i]}</p>` : '' })) };
    }
    case 'slides': {
      const items = (w.slides ?? []).map((s) => {
        const h = headingFromHtml(s.html);
        const desc = strip((s.html ?? '').match(/elementor-slide-description[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? '');
        return { title: h[0]?.text ?? '', text: desc || strip(s.html).replace(h[0]?.text ?? '', '').trim() };
      }).filter((s) => s.title || s.text);
      return items.length ? { kind: 'slides', items } : null;
    }
    case 'posts': case 'bdt-portfolio-carousel': return { kind: '_portfolio', raw: w };
    case 'blogpost': note('fixes', page, 'пустой блок постов (blogpost) удалён'); return null;
    case 'sidebar': return null; // portfolio category sidebar — rebuilt by the template
    case 'icon': return null; // paired icon+heading groups, icon dropped (decorative)
    default:
      if (FORM_TYPES.has(t)) return w.form ? { kind: '_form', raw: w } : null;
      note('unknown', page, `виджет ${w.type}`);
      return null;
  }
}

/** Groups loose card-like widgets into list widgets. */
function groupWidgets(page, widgets) {
  const out = [];
  for (const w of widgets) {
    const prev = out[out.length - 1];
    if (!w.raw || ['_form', '_portfolio'].includes(w.kind)) { // already grouped, or handled at section level
      if (prev && w.items && prev.kind === w.kind && ['cards', 'counters', 'iconboxes', 'steps', 'process', 'progress'].includes(w.kind)) { prev.items.push(...w.items); continue; }
      out.push(w); continue;
    }
    const r = w.raw;
    const hs = headingFromHtml(r.html);
    let kind, item;
    switch (w.kind) {
      case '_feature': {
        const title = hs[0]?.text || '';
        const desc = cleanHtml(page, (r.html ?? '').match(/feature-box-desc[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? '');
        const href = normHref(page, r.links?.find((l) => l.href && l.href !== '#')?.href);
        const linkLabel = r.links?.find((l) => l.text)?.text;
        if (r.links?.some((l) => l.href === '#')) note('fixes', page, `«${linkLabel ?? title}» вела на "#"`);
        if (/^\d+\.\s/.test(title)) { kind = 'process'; item = { num: title.match(/^\d+/)[0], title: title.replace(/^\d+\.\s*/, ''), text: strip(desc) }; break; }
        const icon = r.images?.map((i) => asset(i.src)).find(Boolean);
        kind = 'cards';
        item = { ...(icon && { icon }), ...(!icon && iconName(r.html) && { iconName: iconName(r.html) }), title, ...(strip(desc) && { text: strip(desc) }), ...(href && { href }), ...(linkLabel && href && { linkLabel }) };
        break;
      }
      case '_iconbox': kind = 'iconboxes'; item = { iconName: iconName(r.html) ?? 'circle', title: hs[0]?.text ?? strip(r.html) }; break;
      case '_service': {
        const num = strip((r.html ?? '').match(/service-box-number[^>]*>([\s\S]*?)<\//)?.[1] ?? '');
        kind = 'steps'; item = { num, text: strip((r.html ?? '').match(/service-box-desc[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? '') };
        break;
      }
      case '_counter': {
        const value = strip((r.html ?? '').match(/<h1>([\s\S]*?)<\/h1>/)?.[1] ?? '');
        const suffix = strip((r.html ?? '').match(/<h3>([\s\S]*?)<\/h3>/)?.[1] ?? '');
        const label = strip((r.html ?? '').match(/counter_title[\s\S]*?<h4>([\s\S]*?)<\/h4>/)?.[1] ?? '');
        kind = 'counters'; item = { ...(iconName(r.html) && { iconName: iconName(r.html) }), value, suffix, label };
        break;
      }
      case '_progress': {
        kind = 'progress'; item = { label: strip((r.html ?? '').match(/elementor-title[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? r.text), value: +((r.html ?? '').match(/aria-valuenow="(\d+)"/)?.[1] ?? 0) };
        break;
      }
      case '_image-box': case '_team': {
        const name = hs[0]?.text ?? '';
        const role = strip(r.html).replace(name, '').trim();
        const photoUrl = r.images?.[0]?.src;
        out.push({ kind: '_person', name, role, photo: asset(photoUrl), photoUrl });
        continue;
      }
    }
    if (prev?.kind === kind) prev.items.push(item);
    else out.push({ kind, ...(kind === 'cards' && { columns: 0 }), items: [item] });
  }
  for (const w of out) {
    if (w.kind === 'cards') w.columns = Math.min(5, Math.max(1, w.items.length));
    if (w.kind === 'steps') w.items.sort((a, b) => +a.num - +b.num);
  }
  return out;
}

// ---------- layout conversion ----------
/** Greedy flex-wrap emulation: packs children into rows by rendered width. */
function packRows(node) {
  const kids = node.children.filter((c) => c.children ? c.children.length : true);
  const rows = [];
  let row = [], used = 0;
  const limit = (node.width || 1140) * 1.03;
  for (const k of kids) {
    const w = k.width || node.width;
    if (row.length && used + w > limit) { rows.push(row); row = []; used = 0; }
    row.push(k); used += w;
  }
  if (row.length) rows.push(row);
  return rows;
}

function convertColumn(page, node) {
  // node: column/container — its children are widgets or nested sections.
  const widgets = [];
  if (!node.children) { const w = convertWidget(page, node); return w ? [w] : []; }
  for (const c of node.children) {
    if (!c.children) { const w = convertWidget(page, c); if (w) widgets.push(w); continue; }
    const rows = rowsOf(page, c);
    for (const r of rows) {
      if (r.columns.length === 1) widgets.push(...r.columns[0].widgets);
      else widgets.push({ kind: 'row', columns: r.columns, reverseOnMobile: false });
    }
  }
  return groupWidgets(page, widgets);
}

function rowsOf(page, node) {
  if (!node.children) { const w = convertWidget(page, node); return w ? [{ columns: [{ span: 12, widgets: groupWidgets(page, [w]) }] }] : []; }
  const hasColumns = node.children.some((c) => c.type === 'column');
  const packed = hasColumns ? [node.children.filter((c) => c.type === 'column')] : packRows(node);
  const rows = [];
  for (const r of packed) {
    const total = r.reduce((s, c) => s + (c.width || 0), 0) || 1;
    // A row whose children are bare widgets (container in "column" mode) is a single column.
    if (r.every((c) => !c.children)) { rows.push({ columns: [{ span: 12, widgets: groupWidgets(page, r.map((c) => convertWidget(page, c)).filter(Boolean)) }] }); continue; }
    let cols = r.map((c) => ({ span: Math.max(1, Math.round(((c.width || 0) / total) * 12)), widgets: convertColumn(page, c) }));
    cols = cols.filter((c) => c.widgets.length);
    if (!cols.length) continue;
    const sum = cols.reduce((s, c) => s + c.span, 0);
    if (sum !== 12) cols[cols.length - 1].span += 12 - sum;
    if (cols.length === 1) cols[0].span = 12;
    // Row of single same-kind grouped widgets -> one widget (Elementor grids built from columns).
    const kinds = cols.map((c) => (c.widgets.length === 1 ? c.widgets[0].kind : null));
    if (cols.length > 1 && kinds.every((k) => k && k === kinds[0]) && ['cards', 'counters', 'iconboxes', 'steps', 'process'].includes(kinds[0])) {
      const merged = { ...cols[0].widgets[0], items: cols.flatMap((c) => c.widgets[0].items) };
      if (merged.kind === 'cards') merged.columns = Math.min(5, merged.items.length);
      rows.push({ columns: [{ span: 12, widgets: [merged] }] });
      continue;
    }
    if (cols.length > 1 && kinds.every((k) => k === '_person')) { rows.push({ columns: [{ span: 12, widgets: cols.map((c) => c.widgets[0]) }] }); continue; }
    rows.push({ columns: cols, reverseOnMobile: false });
  }
  // Merge consecutive single-column rows with grid widgets of the same kind (e.g. 2 rows of 4 cards).
  const merged = [];
  for (const r of rows) {
    const p = merged[merged.length - 1];
    const one = (x) => x.columns.length === 1 && x.columns[0].widgets.length === 1 ? x.columns[0].widgets[0] : null;
    const a = p && one(p), b = one(r);
    if (a && b && a.kind === b.kind && ['cards', 'counters', 'iconboxes', 'process'].includes(a.kind)) {
      a.items.push(...b.items);
      if (a.kind === 'cards') a.columns = Math.max(a.columns, b.columns);
      continue;
    }
    merged.push(r);
  }
  return merged;
}

const allWidgets = (rows) => rows.flatMap((r) => r.columns.flatMap((c) => c.widgets.flatMap((w) => (w.kind === 'row' ? allWidgets([w]) : [w]))));

// ---------- section -> block ----------
const teamRegistry = new Map(); // slug -> {name, role(s), photo}
const translit = (s) => s.toLowerCase().replace(/[ъь]/g, '').replace(/./g, (ch) => ({ а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ы: 'y', э: 'e', ю: 'yu', я: 'ya' }[ch] ?? ch)).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function sectionToBlocks(page, s, ctx) {
  const rows = rowsOf(page, s);
  const ws = allWidgets(rows);
  if (!ws.length) return [];
  const background = BG(s.bg, page);
  const kinds = new Set(ws.map((w) => w.kind));
  const title = ws.find((w) => w.kind === 'title');

  if (kinds.has('_form')) {
    const t = title?.text ?? strip(ws.find((w) => w.kind === '_form').raw.heading?.text ?? '');
    return [{ type: 'contactForm', title: t || 'Готовы обсудить условия?' }];
  }
  if (kinds.has('_person')) {
    const people = ws.filter((w) => w.kind === '_person');
    const members = [];
    for (const p of people) {
      if (!p.name) continue;
      if (!p.photo || /ditsolution/.test(p.photoUrl ?? '')) { note('todo', page, `сотрудник «${p.name}» без реального фото (на сайте демо-картинка темы) — скрыт`); continue; }
      const slug = translit(p.name);
      const prev = teamRegistry.get(slug);
      if (prev && prev.role !== p.role) prev.roles.add(`${p.role} (${page})`);
      if (!prev) teamRegistry.set(slug, { name: p.name, role: p.role, photo: p.photo, roles: new Set([`${p.role} (${page})`]) });
      members.push({ member: slug, role: p.role });
    }
    if (!members.length) return [];
    return [{ type: 'team', ...(title && { title: title.text }), ...(title?.lead && { lead: title.lead }), background: background === 'lavender' ? 'pattern-pink' : background, members }];
  }
  if (kinds.has('_portfolio')) {
    const raw = ws.find((w) => w.kind === '_portfolio').raw;
    const items = [...new Set((raw.links ?? []).map((l) => l.href?.match(/\/portfolio-item\/([^/]+)/)?.[1]).filter(Boolean).map(decodeURIComponent))];
    if (ctx.isPortfolioIndex) return [];
    const btn = ws.find((w) => w.kind === 'button');
    return [{ type: 'portfolio', ...(title && { title: title.text }), items, link: { label: btn?.link.label ?? 'Все проекты', href: '/portfolio/' } }];
  }
  if (kinds.has('video') && ws.length <= 4 && title) {
    const v = ws.find((w) => w.kind === 'video');
    const btn = ws.find((w) => w.kind === 'button');
    return [{ type: 'videoLesson', youtubeId: v.youtubeId, title: title.text, text: title.lead ?? ws.find((w) => w.kind === 'text')?.html ?? '', ...(btn && { link: btn.link }) }];
  }
  if (kinds.has('process')) {
    // WP laid the process boxes out as a hand-made zig-zag (with arrow images) that
    // broke on narrow screens: rebuild as one ordered grid with the photos beside it.
    const items = ws.filter((w) => w.kind === 'process').flatMap((w) => w.items).sort((a, b) => +a.num - +b.num);
    const photos = ws.filter((w) => w.kind === 'image');
    note('fixes', page, `«${title?.text}»: ${items.length} шагов собраны в единую сетку`);
    const grid = { kind: 'process', items: items.map(({ title: t, text }) => ({ title: t, text })) };
    return [{ type: 'layout', background, rows: [
      ...(title ? [{ columns: [{ span: 12, widgets: [title] }], reverseOnMobile: false }] : []),
      photos.length ? { columns: [{ span: 8, widgets: [grid] }, { span: 4, widgets: photos }], reverseOnMobile: false } : { columns: [{ span: 12, widgets: [grid] }], reverseOnMobile: false },
    ] }];
  }
  const lessonCards = ws.find((w) => w.kind === 'cards' && w.items.every((i) => /смотреть видео/i.test(i.linkLabel ?? '') || !i.title));
  if (lessonCards && title) {
    const btn = ws.find((w) => w.kind === 'button');
    note('todo', page, 'карточки «Смотреть видео» вели на "#" — нужны ссылки на ролики');
    return [{ type: 'lessons', title: title.text, lead: title.lead ?? '', ...(btn && { link: btn.link }), items: lessonCards.items.map((i) => ({ title: i.text ?? i.title })) }];
  }
  return [{ type: 'layout', background, rows }];
}

/** Post-pass: a layout block holding only a centred title merges into the
 * following team/portfolio block (WP split heading and slider into 2 sections). */
function mergeHeadings(blocks) {
  const out = [];
  for (const b of blocks) {
    const p = out[out.length - 1];
    const onlyTitle = p?.type === 'layout' && p.rows.length === 1 && p.rows[0].columns.length === 1 && p.rows[0].columns[0].widgets.length === 1 && p.rows[0].columns[0].widgets[0].kind === 'title';
    if (onlyTitle && ['team', 'portfolio'].includes(b.type) && !b.title) {
      const t = p.rows[0].columns[0].widgets[0];
      out.pop();
      out.push({ ...b, title: t.text, ...(t.lead && b.type === 'team' && { lead: t.lead }) });
      continue;
    }
    out.push(b);
  }
  return out;
}

// ---------- pages ----------
const read = async (p) => JSON.parse(await readFile(p, 'utf8'));
const pathOf = (url) => decodeURI(new URL(url).pathname);
const pageFiles = (await readdir('extracted/page')).filter((f) => f.endsWith('.json'));
const titleClean = (t) => decode(t).replace(/\s*[–—-]\s*MyFirms.*$/i, '').trim();
const menuOrder = ['marketing-pod-klyuch', 'reklama-v-internete', 'kontekstnaya-reklama', 'targetirovannaya-reklama-v-soczialnyh-setyah', 'video-reklama', 'reklama-u-blogerov', 'seo_prodvizhenie', 'veb-analitika', 'kopirajting', 'kontent-marketing-i-pr', 'smm-prodvizhenie', 'prodvizhenie-na-marketplejsah', 'biznes-analitika'];

await rm(`${OUT}/pages`, { recursive: true, force: true });
await rm(`${OUT}/portfolio`, { recursive: true, force: true });
await rm(`${OUT}/portfolioFilters`, { recursive: true, force: true });
await rm(`${OUT}/team`, { recursive: true, force: true });
for (const d of ['pages', 'portfolio', 'portfolioFilters', 'team']) await mkdir(`${OUT}/${d}`, { recursive: true });

const inventory = Object.fromEntries((await readFile('url-inventory.csv', 'utf8')).slice(1).split('\n').slice(1)
  .map((l) => l.match(/"((?:[^"]|"")*)"/g).map((s) => s.slice(1, -1))).map((r) => [pathOf(r[1]), { title: r[4], h1: r[8] }]));

for (const f of pageFiles) {
  const d = await read(`extracted/page/${f}`);
  const path = pathOf(d.url);
  const slug = f.replace('.json', '');
  const page = path;
  let blocks = d.sections.flatMap((s) => sectionToBlocks(page, s, { isPortfolioIndex: path === '/portfolio/' }));
  blocks = mergeHeadings(blocks);
  if (path === '/') {
    blocks = blocks.filter((b) => !(b.type === 'layout' && allWidgets(b.rows).every((w) => w.kind === 'image' && w.decorative)));
    blocks.unshift({ type: 'hero', slides: [
      { title: 'Привлечем клиентов', subtitle: 'из интернета', points: ['Настроим рекламу под ключ', 'Продвинем сайт в топ-10', 'Настроим сквозную аналитику', 'Запустим PR кампанию'], link: { label: 'Подробнее', href: '/marketing/' } },
      { title: 'Выведем бизнес', subtitle: 'на новый уровень', points: ['Проведем анализ рынка и составим план по его охвату', 'Разместим товары на маркетплейсах', 'Поможем с освоением зарубежных рынков'], link: { label: 'Подробнее', href: '/marketing/' } },
    ] });
  }
  if (path === '/portfolio/') blocks = [];
  if (path === '/contacts/') {
    // The fancy-list item "Реквизиты компании в России" linked to "#" and showed nothing.
    for (const b of blocks) if (b.type === 'layout') for (const r of b.rows) for (const c of r.columns) c.widgets = c.widgets.flatMap((w) => w.kind === 'list' ? w.items.filter((i) => !/Реквизиты/.test(i.text)).map((i) => ({ kind: 'text', html: `<p>${i.text}</p>`, onDark: false })) : [w]);
    blocks.push({ type: 'requisites', title: 'Реквизиты компании в России' });
    note('fixes', page, 'пустой блок «Реквизиты компании в России» заполнен реквизитами');
  }
  const h1 = titleClean(d.title);
  const parent = path.startsWith('/marketing/') && path !== '/marketing/' ? '/marketing/' : undefined;
  const svcSlug = path.split('/').filter(Boolean)[1];
  const order = menuOrder.indexOf(svcSlug);
  const out = {
    path, h1, ...(parent && { parent }),
    seo: seoOverrides[path] ?? { title: `${h1} — MyFirms`, description: '' },
    ...(parent && { service: { order: order >= 0 ? order : 100, menuLabel: h1, inMenu: order >= 0 } }),
    blocks,
  };
  if (out.service) { const inMenu = out.service.inMenu; delete out.service.inMenu; if (!inMenu) note('todo', page, 'страница услуги не в меню — оставлена, ссылки только из контента'); }
  if (!seoOverrides[path]) note('todo', page, 'нет SEO title/description в _seo.json');
  await writeFile(`${OUT}/pages/${slug === 'index' ? 'home' : slug}.json`, JSON.stringify(out, null, 1) + '\n');
}

// ---------- portfolio ----------
const filterOf = {};
for (const [fslug, f] of Object.entries(filtersRaw)) {
  if (!f.items.length) { note('fixes', `/portfolio_filter/${fslug}/`, `пустая рубрика «${f.name}» — не переносится, 301 на /portfolio/`); continue; }
  for (const it of f.items) (filterOf[it] ??= []).push(fslug);
  await writeFile(`${OUT}/portfolioFilters/${fslug}.json`, JSON.stringify({ name: f.name, order: f.order, seo: seoOverrides[`/portfolio_filter/${fslug}/`] ?? { title: `${f.name} — кейсы MyFirms`, description: '' } }, null, 1) + '\n');
}
const listingOrder = (await read('extracted/page/portfolio.json')).sections.flatMap((s) => JSON.stringify(s).match(/portfolio-item\/[^/"\\]+/g) ?? []).map((x) => decodeURIComponent(x.split('/')[1]));
const order = [...new Set(listingOrder)];
for (const f of (await readdir('extracted/portfolio')).filter((x) => x.endsWith('.json'))) {
  const d = await read(`extracted/portfolio/${f}`);
  const slug = pathOf(d.url).split('/').filter(Boolean).pop();
  const page = pathOf(d.url);
  const raw = await readFile(`raw/portfolio/${f.replace('.json', '.html')}`, 'utf8');
  const og = raw.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
  const image = asset(og);
  if (!image) note('todo', page, `обложка не найдена ${og}`);
  const ws = d.sections.flatMap((s) => allWidgets(rowsOf(page, s)));
  const body = [];
  let headline = '';
  for (const w of ws) {
    if (w.kind === 'title' && !headline) { headline = w.text; continue; }
    if (w.kind === 'title') body.push({ heading: w.text, html: w.lead ?? '' });
    else if (w.kind === 'text' || w.kind === 'list') {
      const html = w.kind === 'text' ? w.html : `<ul>${w.items.map((i) => `<li>${i.text}</li>`).join('')}</ul>`;
      if (body.length) body[body.length - 1].html += html; else body.push({ html });
    }
  }
  const results = ws.filter((w) => w.kind === 'counters').flatMap((w) => w.items.map(({ value, suffix, label }) => ({ value, suffix, label })));
  const title = titleClean(d.title);
  await writeFile(`${OUT}/portfolio/${slug}.json`, JSON.stringify({
    title, headline: headline || title, image: image ?? 'wp/placeholder.jpg', filters: filterOf[slug] ?? [], order: order.indexOf(slug) >= 0 ? order.indexOf(slug) : 99,
    seo: seoOverrides[page] ?? { title: `${title} — кейс MyFirms`, description: '' }, body, results,
  }, null, 1) + '\n');
  if (!filterOf[slug]) note('todo', page, 'кейс без рубрики');
}

// ---------- team ----------
for (const [slug, m] of teamRegistry) {
  if (m.roles.size > 1) note('todo', `team/${slug}`, `у «${m.name}» разные должности на разных страницах: ${[...m.roles].join('; ')} — взята первая`);
  await writeFile(`${OUT}/team/${slug}.json`, JSON.stringify({ name: m.name, role: m.role, photo: m.photo }, null, 1) + '\n');
}

const uniq = (a) => [...new Set(a)];
await writeFile('extracted/_report.md', `# Отчёт конвертера\n\n## Исправлено автоматически\n${uniq(report.fixes).map((x) => `- ${x}`).join('\n')}\n\n## Требует решения\n${uniq(report.todo).map((x) => `- ${x}`).join('\n')}\n\n## Не распознано\n${uniq(report.unknown).map((x) => `- ${x}`).join('\n')}\n`);
console.log(`pages ${pageFiles.length}, team ${teamRegistry.size}, fixes ${uniq(report.fixes).length}, todo ${uniq(report.todo).length}, unknown ${uniq(report.unknown).length}`);
