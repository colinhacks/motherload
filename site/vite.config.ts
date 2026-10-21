import path from 'node:path';
import { docsKit } from 'docs-kit/vite';
import { defineConfig } from 'vite';
import * as mdxConfig from './source.config.ts';

// docs-kit's plugins (docs-kit/src/vite.ts): fumadocs-mdx over source.config.ts, Tailwind 4, React
// Router, and what keeps `vite dev` cheap on a large page (one compile per edit, a small module, a
// section re-rendered alone). `@/` is the site's root; `collections` is fumadocs-mdx's generated
// .source/ (lib/source.ts).
export default defineConfig({
  plugins: docsKit(mdxConfig),
  resolve: {
    alias: {
      '@': import.meta.dirname,
      collections: path.join(import.meta.dirname, '.source'),
    },
  },
  server: { port: 3312 },
  // @vercel/og (the link preview, app/routes/opengraph-image.tsx) loads its WebAssembly with a
  // `require` Vite's module runner cannot run, so Node loads it.
  ssr: { external: ['@vercel/og'] },
});
