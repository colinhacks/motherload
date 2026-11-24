import { copyFileSync } from 'node:fs';
import type { Config } from '@react-router/dev/config';
import { docsPrerender } from 'docs-kit/routes';

// The site builds to static files only (build/client): no server renders at run time
// (`ssr: false`), and every path the site has is rendered at build time: the page, the showcase and
// Every format, the files beside them, and the page for a missing address, which Vercel serves from
// 404.html.
export default {
  ssr: false,
  prerender: [...docsPrerender(), '/showcase', '/formats', '/opengraph-image.png'],
  buildEnd() {
    copyFileSync('build/client/404/index.html', 'build/client/404.html');
  },
} satisfies Config;
