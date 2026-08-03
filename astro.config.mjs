import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

// Deploying to Vercel by default. To deploy to Netlify instead, swap this adapter
// for @astrojs/netlify — nothing else is host-specific: share links carry the whole
// bouquet in the URL, so there is no storage to provision or migrate.
export default defineConfig({
  output: 'server',
  adapter: vercel(),
});
