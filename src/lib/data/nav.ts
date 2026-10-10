import { pagesRepository } from '../repository';

export interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];
}

/** Top-bar links above the main menu (as on WP). */
export const topLinks: NavItem[] = [
  { label: 'О компании', href: '/o-kompanii/' },
  { label: 'Контакты', href: '/contacts/' },
];

/** Main menu: "Услуги по маркетингу" (with the service pages that were in the
 * WP menu, in WP menu order) and "Портфолио". */
export async function getMainNav(): Promise<NavItem[]> {
  const pages = await pagesRepository.getAll();
  const services = pages
    .filter((p) => p.data.service && p.data.service.order < 100)
    .sort((a, b) => a.data.service!.order - b.data.service!.order)
    .map((p) => ({ label: p.data.service!.menuLabel, href: p.data.path }));
  return [
    { label: 'Услуги по маркетингу', href: '/marketing/', children: services },
    { label: 'Портфолио', href: '/portfolio/' },
  ];
}
