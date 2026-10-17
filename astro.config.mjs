import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://adr.stephens.page',
  trailingSlash: 'always',
  // The Apache policy permits same-origin assets and blocks inline scripts.
  vite: { build: { assetsInlineLimit: 0 } },
});
