// Prints a compact outline of an extracted page tree.
import { readFileSync } from 'node:fs';
const d = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const W = +(process.argv[3] ?? 70);
const bg = (b) => b ? [b.color, b.image && 'img:' + b.image.split('/').pop(), b.gradient && 'grad', b.overlay && 'ovl'].filter(Boolean).join(' ') : '';
const pr = (n, ind) => {
  if (n.children) {
    const solo = n.type === 'column' && !bg(n.bg);
    if (!solo) console.log(`${ind}${n.type === 'column' ? 'col' : '§'}${n.id} w${n.width} h${n.height} ${bg(n.bg)}${n.slider ? ' SLIDER:' + n.slider : ''}`);
    else console.log(`${ind}col w${n.width}`);
    n.children.forEach((c) => pr(c, ind + '  '));
    return;
  }
  const i = n;
  const parts = [i.type.split('.')[0], i.heading && `${i.heading.tag}:"${i.heading.text.slice(0, 40)}"`, i.text && `"${i.text.slice(0, W)}"`,
    i.images && 'IMG:' + i.images.map((x) => x.src.split('/').pop().slice(0, 28)).join(','), i.links && 'A:' + i.links.map((l) => `${l.text.slice(0, 18)}>${l.href.replace('https://myfirms.ru', '').slice(0, 36)}`).join(';'),
    i.form && 'FORM:' + i.form, i.video && 'VIDEO', i.slides && `SLIDES:${i.slides.length}`].filter(Boolean);
  console.log(`${ind}- ${parts.join(' ')}`);
};
if (d.banner) console.log('BANNER', JSON.stringify(d.banner).slice(0, 200));
d.sections.forEach((s) => pr(s, ''));
if (d.article) console.log('ARTICLE', d.article.cls, d.article.html.length);
