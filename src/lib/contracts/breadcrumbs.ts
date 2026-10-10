/**
 * Breadcrumbs contract — one reusable shape for the whole site (ported from
 * the Octopel project). The WP site rendered "Главная > Раздел > Страница"
 * as plain spans with no structured data.
 *
 * Rendering contract (enforced by components/astro/foundation/Breadcrumbs.astro):
 * - The LAST item in `items` is the current page: it renders as
 *   `<span aria-current="page">`, never as a link, even though it carries
 *   an `href` (kept for JSON-LD `toBreadcrumbList` below).
 * - Root: `<nav aria-label="Хлебные крошки"><ol>...</ol></nav>`.
 * - Homepage never renders <Breadcrumbs> (it has no parent to show).
 */
export interface BreadcrumbItem {
  label: string;
  href: string;
}

export interface BreadcrumbListJsonLd {
  '@context': 'https://schema.org';
  '@type': 'BreadcrumbList';
  itemListElement: Array<{
    '@type': 'ListItem';
    position: number;
    name: string;
    item: string;
  }>;
}

/** Builds a schema.org BreadcrumbList JSON-LD object from the same `items`
 * passed to <Breadcrumbs>, so the visible trail and the structured data can
 * never drift apart. */
export function toBreadcrumbList(items: BreadcrumbItem[], siteUrl: string): BreadcrumbListJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      item: new URL(item.href, siteUrl).toString(),
    })),
  };
}
