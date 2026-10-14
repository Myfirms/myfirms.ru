import { createContentCollectionRepository } from './contentCollectionRepository';

/**
 * Repository/adapter boundary. Import data through these repositories
 * everywhere else in the app — never `getCollection`/`getEntry` from
 * `astro:content` directly outside this folder.
 */
export const pagesRepository = createContentCollectionRepository('pages');
export const portfolioRepository = createContentCollectionRepository('portfolio');
export const portfolioFiltersRepository = createContentCollectionRepository('portfolioFilters');
export const teamRepository = createContentCollectionRepository('team');
export const legalRepository = createContentCollectionRepository('legal');
export const adsToolRepository = createContentCollectionRepository('adsTool');

export type { ContentRepository } from './types';
