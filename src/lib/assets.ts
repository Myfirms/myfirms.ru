import type { ImageMetadata } from 'astro';

/**
 * Content stores image paths relative to src/assets/ ("wp/2022/01/02.jpg").
 * This resolves them to astro:assets metadata so <Image>/<Picture> can
 * optimise them; a missing file fails the build instead of shipping a
 * broken image.
 */
const files = import.meta.glob<{ default: ImageMetadata }>('/src/assets/**/*.{jpg,jpeg,png,webp,avif,gif}', { eager: true });

export function asset(path: string): ImageMetadata {
  const mod = files[`/src/assets/${path}`];
  if (!mod) throw new Error(`Image not found in src/assets: ${path}`);
  return mod.default;
}
