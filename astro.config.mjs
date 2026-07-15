import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

// Deploying to Vercel by default (serverless short-link endpoints under src/pages/api).
// To deploy to Netlify instead, swap this adapter for @astrojs/netlify — everything else
// (routes, storage adapter in src/lib/kv.ts) is written to be host-agnostic.
export default defineConfig({
  output: 'server',
  adapter: vercel(),
});
