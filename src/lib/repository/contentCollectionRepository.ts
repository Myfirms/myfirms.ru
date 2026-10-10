import { getCollection, getEntry, type CollectionEntry, type CollectionKey } from 'astro:content';
import type { ContentRepository } from './types';

/**
 * Local Content Collections implementation of `ContentRepository`. This is
 * the ONLY file that should ever import from `astro:content`. Replacing
 * local content with a remote headless CMS later means adding a sibling
 * `httpRepository.ts` implementing the same `ContentRepository<T>` interface
 * and swapping the export in `repository/index.ts` — page templates and
 * components stay unchanged.
 */
export function createContentCollectionRepository<C extends CollectionKey>(
  collection: C
): ContentRepository<CollectionEntry<C>> {
  return {
    async getAll() {
      return getCollection(collection);
    },
    async getBySlug(slug: string) {
      // `getEntry`'s generic overloads can't be proven against a generic
      // `C extends CollectionKey` by the compiler (a known Astro Content
      // Collections generics limitation); the runtime behavior is correct
      // for every concrete collection this is instantiated with below.
      return getEntry(collection, slug) as Promise<CollectionEntry<C> | undefined>;
    },
  };
}
