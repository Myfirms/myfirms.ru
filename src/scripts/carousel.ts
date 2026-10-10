/**
 * Progressive-enhancement carousel. Markup contract:
 *   [data-carousel]            root (optionally data-autoplay="ms")
 *     [data-carousel-track]    horizontally scrollable, CSS scroll-snap
 *     [data-carousel-prev] / [data-carousel-next]   optional buttons
 *     [data-carousel-dots]     optional, filled with one button per page
 * Without JS the track is still swipeable/scrollable. Replaces the four
 * slider libraries the WP site loaded (Swiper, Slick, Owl, Revolution).
 */
function init(root: HTMLElement) {
  if (root.dataset.carouselReady) return;
  root.dataset.carouselReady = '1';
  const track = root.querySelector<HTMLElement>('[data-carousel-track]');
  if (!track) return;
  const items = () => [...track.children] as HTMLElement[];
  const step = () => {
    const first = items()[0];
    if (!first) return track.clientWidth;
    const gap = parseFloat(getComputedStyle(track).columnGap || '0') || 0;
    return first.getBoundingClientRect().width + gap;
  };
  const atEnd = () => track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
  const go = (dir: 1 | -1) => {
    if (dir === 1 && atEnd()) track.scrollTo({ left: 0, behavior: 'smooth' });
    else if (dir === -1 && track.scrollLeft <= 4) track.scrollTo({ left: track.scrollWidth, behavior: 'smooth' });
    else track.scrollBy({ left: dir * step(), behavior: 'smooth' });
  };
  root.querySelector('[data-carousel-prev]')?.addEventListener('click', () => go(-1));
  root.querySelector('[data-carousel-next]')?.addEventListener('click', () => go(1));

  const dots = root.querySelector<HTMLElement>('[data-carousel-dots]');
  if (dots) {
    const pages = () => Math.max(1, Math.round(track.scrollWidth / track.clientWidth));
    const render = () => {
      dots.replaceChildren(
        ...Array.from({ length: pages() }, (_, i) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.setAttribute('aria-label', `Слайд ${i + 1}`);
          b.addEventListener('click', () => track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' }));
          return b;
        }),
      );
      sync();
    };
    const sync = () => {
      const i = Math.round(track.scrollLeft / track.clientWidth);
      [...dots.children].forEach((d, n) => d.setAttribute('aria-current', n === i ? 'true' : 'false'));
    };
    track.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
    new ResizeObserver(render).observe(track);
  }

  const ms = Number(root.dataset.autoplay);
  if (ms > 0 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let timer = window.setInterval(() => go(1), ms);
    const stop = () => window.clearInterval(timer);
    root.addEventListener('pointerenter', stop);
    root.addEventListener('focusin', stop);
    root.addEventListener('pointerleave', () => {
      stop();
      timer = window.setInterval(() => go(1), ms);
    });
  }
}

document.querySelectorAll<HTMLElement>('[data-carousel]').forEach(init);
