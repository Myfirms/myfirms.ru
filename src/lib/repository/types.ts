/**
 * Generic repository boundary. Page templates and components depend on this
 * interface, never on `astro:content` directly — see repository/index.ts.
 */
export interface ContentRepository<T> {
  getAll(): Promise<T[]>;
  getBySlug(slug: string): Promise<T | undefined>;
}
