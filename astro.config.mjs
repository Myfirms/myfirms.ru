// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://myfirms.ru',
  // Every URL of the WordPress site ends in "/" — kept 1:1 so no indexed URL changes.
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [
    react(),
    sitemap({
      filter: (page) => !new URL(page).pathname.startsWith('/internal/'),
    }),
  ],
});
