import { defineCollection, reference } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

/**
 * Content model.
 *
 * Every page body is an ordered list of `blocks`. Recurring section patterns
 * of the old Elementor site are semantic block types (contactForm, team,
 * videoLesson, portfolio, …); one-off Elementor sections are kept as a
 * generic `layout` block — rows of columns holding typed `widgets` — so the
 * 1:1 port does not need a bespoke component per freeform section. A layout
 * block can be promoted to a semantic type later without touching templates
 * (the renderer is a single switch in components/astro/blocks/Blocks.astro).
 *
 * Images are paths relative to src/assets/ (e.g. "wp/2022/01/02.jpg") and
 * are resolved through lib/assets.ts so astro:assets can optimise them.
 */

const imageRef = z.string().describe('path under src/assets/');

/** Section backgrounds, mapped from the WP section colours/images. */
export const backgrounds = [
  'white', 'gray', 'pink', 'sky', 'sand', 'lavender', 'dark', 'accent',
  'pattern-pink', 'pattern-white', 'shape-sky', 'shape-gray', 'glow-dark', 'contact',
] as const;
const background = z.enum(backgrounds);

const link = z.object({
  label: z.string(),
  /** Omitted = opens the request-form dialog (the WP "#" buttons). */
  href: z.string().optional(),
});

const image = z.object({ src: imageRef, alt: z.string().default('') });

const widget: z.ZodType<Widget> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('title'),
      text: z.string(),
      level: z.enum(['h2', 'h3']).default('h2'),
      /** Small chip label above the title ("О компании"). */
      eyebrow: z.string().optional(),
      lead: z.string().optional().describe('html'),
      align: z.enum(['left', 'center']).default('left'),
      onDark: z.boolean().default(false),
    }),
    z.object({ kind: z.literal('text'), html: z.string(), onDark: z.boolean().default(false) }),
    z.object({ kind: z.literal('button'), link, variant: z.enum(['primary', 'accent']).default('primary') }),
    z.object({ kind: z.literal('image'), ...image.shape, rounded: z.boolean().default(true), decorative: z.boolean().default(false) }),
    z.object({ kind: z.literal('carousel'), images: z.array(image), logos: z.boolean().default(false) }),
    z.object({
      kind: z.literal('cards'),
      columns: z.number().int().min(1).max(5),
      items: z.array(z.object({ icon: imageRef.optional(), iconName: z.string().optional(), title: z.string(), text: z.string().optional(), href: z.string().optional(), linkLabel: z.string().optional() })),
    }),
    z.object({ kind: z.literal('steps'), items: z.array(z.object({ num: z.string(), text: z.string() })) }),
    z.object({ kind: z.literal('process'), items: z.array(z.object({ title: z.string(), text: z.string() })) }),
    z.object({ kind: z.literal('counters'), items: z.array(z.object({ iconName: z.string().optional(), value: z.string(), suffix: z.string().default(''), label: z.string() })) }),
    z.object({ kind: z.literal('progress'), items: z.array(z.object({ label: z.string(), value: z.number() })) }),
    z.object({ kind: z.literal('iconboxes'), items: z.array(z.object({ iconName: z.string(), title: z.string() })) }),
    z.object({ kind: z.literal('list'), icon: z.enum(['check', 'pin', 'dot']).default('check'), items: z.array(z.object({ text: z.string(), href: z.string().optional() })) }),
    z.object({ kind: z.literal('quote'), text: z.string() }),
    z.object({ kind: z.literal('video'), youtubeId: z.string(), title: z.string().optional() }),
    z.object({ kind: z.literal('tabs'), items: z.array(z.object({ title: z.string(), html: z.string() })) }),
    z.object({ kind: z.literal('slides'), items: z.array(z.object({ title: z.string(), text: z.string() })) }),
    z.object({ kind: z.literal('row'), columns: z.array(z.object({ span: z.number(), widgets: z.array(widget) })), reverseOnMobile: z.boolean().default(false) }),
  ]),
);

export type Widget =
  | { kind: 'title'; text: string; level: 'h2' | 'h3'; eyebrow?: string; lead?: string; align: 'left' | 'center'; onDark: boolean }
  | { kind: 'text'; html: string; onDark: boolean }
  | { kind: 'button'; link: { label: string; href?: string }; variant: 'primary' | 'accent' }
  | { kind: 'image'; src: string; alt: string; rounded: boolean; decorative: boolean }
  | { kind: 'carousel'; images: { src: string; alt: string }[]; logos: boolean }
  | { kind: 'cards'; columns: number; items: { icon?: string; iconName?: string; title: string; text?: string; href?: string; linkLabel?: string }[] }
  | { kind: 'steps'; items: { num: string; text: string }[] }
  | { kind: 'process'; items: { title: string; text: string }[] }
  | { kind: 'counters'; items: { iconName?: string; value: string; suffix: string; label: string }[] }
  | { kind: 'progress'; items: { label: string; value: number }[] }
  | { kind: 'iconboxes'; items: { iconName: string; title: string }[] }
  | { kind: 'list'; icon: 'check' | 'pin' | 'dot'; items: { text: string; href?: string }[] }
  | { kind: 'quote'; text: string }
  | { kind: 'video'; youtubeId: string; title?: string }
  | { kind: 'tabs'; items: { title: string; html: string }[] }
  | { kind: 'slides'; items: { title: string; text: string }[] }
  | { kind: 'row'; columns: { span: number; widgets: Widget[] }[]; reverseOnMobile: boolean };

const block = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('hero'),
    slides: z.array(z.object({ title: z.string(), subtitle: z.string(), points: z.array(z.string()), link })),
  }),
  z.object({
    type: z.literal('layout'),
    background: background.default('white'),
    /** Rows of columns; spans are twelfths. */
    rows: z.array(z.object({ columns: z.array(z.object({ span: z.number(), widgets: z.array(widget) })), reverseOnMobile: z.boolean().default(false) })),
  }),
  /** Company requisites (from lib/data/company.ts) — the WP block under this heading was empty. */
  z.object({ type: z.literal('requisites'), title: z.string().default('Реквизиты компании в России') }),
  z.object({ type: z.literal('contactForm'), title: z.string().default('Готовы обсудить условия?') }),
  z.object({ type: z.literal('team'), title: z.string().optional(), lead: z.string().optional(), background: background.default('pattern-pink'),
    /** Role is per page: the WP site shows different titles for the same person on different pages. */
    members: z.array(z.object({ member: reference('team'), role: z.string() })),
  }),
  z.object({ type: z.literal('videoLesson'), youtubeId: z.string(), title: z.string(), text: z.string(), link: link.optional() }),
  z.object({ type: z.literal('portfolio'), title: z.string().optional(), items: z.array(reference('portfolio')), link: link.optional() }),
  z.object({ type: z.literal('lessons'), title: z.string(), lead: z.string(), link: link.optional(), items: z.array(z.object({ title: z.string(), href: z.string().optional() })) }),
]);
export type Block = z.infer<typeof block>;

const seo = z.object({
  /** <title>. */
  title: z.string(),
  description: z.string(),
  ogImage: imageRef.optional(),
});

/** Every non-portfolio page: home, /marketing/, services, about, contacts. */
const pages = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/pages' }),
  schema: z.object({
    /** URL path with leading and trailing slash, e.g. "/marketing/smm-prodvizhenie/". */
    path: z.string().regex(/^\/(.+\/)?$/),
    /** Visible H1 (page banner). */
    h1: z.string(),
    /** Breadcrumb label (defaults to h1). */
    crumb: z.string().optional(),
    parent: z.string().optional().describe('path of the parent page for breadcrumbs'),
    seo,
    /** Menu/listing card data for service pages. */
    service: z.object({ order: z.number(), menuLabel: z.string() }).optional(),
    blocks: z.array(block),
  }),
});

const portfolioFilters = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/portfolioFilters' }),
  schema: z.object({ name: z.string(), order: z.number(), seo }),
});

const portfolio = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/portfolio' }),
  schema: z.object({
    title: z.string(),
    /** Case headline (first heading of the case body). */
    headline: z.string(),
    image: imageRef,
    filters: z.array(reference('portfolioFilters')),
    order: z.number(),
    seo,
    body: z.array(z.object({ heading: z.string().optional(), html: z.string() })),
    results: z.array(z.object({ value: z.string(), suffix: z.string(), label: z.string() })).default([]),
  }),
});

const team = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/team' }),
  schema: z.object({ name: z.string(), role: z.string(), photo: imageRef }),
});

const legal = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/legal' }),
  schema: z.object({ title: z.string(), path: z.string(), seo, updated: z.string() }),
});

/** English documents for the Google Ads API tool (Google OAuth / brand verification): /ads-tool/*. */
const adsTool = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/adsTool' }),
  schema: z.object({ title: z.string(), heading: z.string(), updated: z.string(), description: z.string() }),
});

export const collections = { pages, portfolio, portfolioFilters, team, legal, adsTool };
