import { route, type RouteConfig } from '@react-router/dev/routes';
import { docsRoutes } from 'docs-kit/routes';

// Docs Kit's routes (the page at /, the page a missing address gets, /llms.txt, robots.txt, the
// sitemap and the manifest), the showcase and Every format (two unlisted pages for screenshots), and
// the link preview, each rendered to a file at build time (react-router.config.ts).
export default [
  ...docsRoutes(),
  route('showcase', 'routes/showcase.tsx'),
  route('formats', 'routes/formats.tsx'),
  route('opengraph-image.png', 'routes/opengraph-image.tsx'),
] satisfies RouteConfig;
