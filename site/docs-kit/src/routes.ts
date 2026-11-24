// A docs site's routes, for its `app/routes.ts`, and the paths to render at build time, for its
// `react-router.config.ts` (README, "The routes"). Docs Kit's own route modules are `./routes/`, given to
// React Router by absolute path; the page route is the site's file, and a site replaces any of the
// others with its own file, or leaves one out with `false`:
//
//   export default [
//     ...docsRoutes({ llms: 'routes/llms.ts' }),
//     route('opengraph-image.png', 'routes/opengraph-image.tsx'),
//   ] satisfies RouteConfig;
import { fileURLToPath } from 'node:url';
import { route, type RouteConfigEntry } from '@react-router/dev/routes';
import { pageSlugs } from './mdx/page-files.ts';

/** One of Docs Kit's route modules, by absolute path. */
const own = (file: string) => fileURLToPath(new URL(`./routes/${file}`, import.meta.url));

/** A route of Docs Kit's that a site replaces with its own file (a path in `app/`, as `route` takes) or leaves out. */
type Own = string | false;

export type DocsRoutesOptions = {
  /** The page route, the site's own: `routes/page.tsx`, at `/` and `/:slug`. */
  page?: string;
  llms?: Own;
  markdown?: Own;
  robots?: Own;
  sitemap?: Own;
  manifest?: Own;
  notFound?: Own;
};

/**
 * The routes every docs site has: its pages, `/404`, `/llms.txt`, `/robots.txt`, `/sitemap.xml`,
 * `/manifest.webmanifest`, and on a site of several pages each page's `.md`.
 */
export function docsRoutes({ page = 'routes/page.tsx', ...options }: DocsRoutesOptions = {}): RouteConfigEntry[] {
  const pick = (name: keyof Omit<DocsRoutesOptions, 'page'>, file: string) => (options[name] === false ? undefined : options[name] ?? own(file));
  const pages = pageSlugs();
  const markdown = pages.length > 1 ? pick('markdown', 'markdown.ts') : undefined;
  return [
    route(':slug?', page),
    ...(markdown ? pages.map((slug) => `${slug || 'index'}.md`).map((file) => route(file, markdown, { id: `docs-kit/markdown/${file}` })) : []),
    ...(
      [
        ['404', pick('notFound', 'not-found.tsx')],
        ['llms.txt', pick('llms', 'llms.ts')],
        ['robots.txt', pick('robots', 'robots.ts')],
        ['sitemap.xml', pick('sitemap', 'sitemap.ts')],
        ['manifest.webmanifest', pick('manifest', 'manifest.ts')],
      ] as const
    ).flatMap(([path, file]) => (file ? [route(path, file)] : [])),
  ];
}

/**
 * The paths of `docsRoutes` to render at build time, for `prerender` in the site's
 * `react-router.config.ts`, with the same options; the site adds its own routes' paths.
 */
export function docsPrerender(options: Omit<DocsRoutesOptions, 'page'> = {}): string[] {
  const pages = pageSlugs();
  const several = pages.length > 1 && options.markdown !== false;
  const files: [string, Own | undefined][] = [
    ['/404', options.notFound],
    ['/llms.txt', options.llms],
    ['/robots.txt', options.robots],
    ['/sitemap.xml', options.sitemap],
    ['/manifest.webmanifest', options.manifest],
  ];
  return [...pages.map((slug) => `/${slug}`), ...(several ? pages.map((slug) => `/${slug || 'index'}.md`) : []), ...files.filter(([, file]) => file !== false).map(([path]) => path)];
}
