import { route, type RouteConfig } from '@react-router/dev/routes';

// The page, at /, the showcase and Every format (two unlisted pages for screenshots), the page a
// missing address gets, and the files beside them, the link preview among them, each rendered to a
// file at build time (react-router.config.ts).
export default [
  route(':slug?', 'routes/page.tsx'),
  route('showcase', 'routes/showcase.tsx'),
  route('formats', 'routes/formats.tsx'),
  route('404', 'routes/not-found.tsx'),
  route('llms.txt', 'routes/llms.ts'),
  route('robots.txt', 'routes/robots.ts'),
  route('sitemap.xml', 'routes/sitemap.ts'),
  route('manifest.webmanifest', 'routes/manifest.ts'),
  route('opengraph-image.png', 'routes/opengraph-image.tsx'),
] satisfies RouteConfig;
