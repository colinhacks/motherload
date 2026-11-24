// A docs site's build-time half: the page source, each page's loader, and its files and Markdown. Run
// only while the site is built or served by the dev server, never in the browser: a route imports it
// from its loader alone, which React Router takes out of the browser's bundle.

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { docs } from 'collections/server';
import { loader } from 'fumadocs-core/source';
import site from '@/docs.config';
import { pageFiles, pageSlugs } from './mdx/page-files.ts';
import { pageMarkdown } from './mdx/remark-sections.ts';
import type { PageData } from './page';

/** The site's pages (`content/docs`), as Fumadocs reads them. */
export const source = loader({ baseUrl: '/', source: docs.toFumadocsSource() });

/** The site's pages in reading order, by slug (`''` for the first): the config's `pages`, or every page of `content/docs`. */
export function sitePageSlugs(): string[] {
  return [...(site.pages ?? pageSlugs())];
}

/**
 * A page as Markdown, for an agent (`pageMarkdown`): its files' sources, each first rewritten by
 * `transform` where the site writes into the Markdown what its own components show (Reylo's inferred
 * types and errors).
 */
export async function markdownOf(slug: string, transform: (source: string) => string = (source) => source): Promise<string> {
  const files = slug ? [path.resolve('content/docs', `${slug}.mdx`)] : pageFiles();
  const sources = await Promise.all(files.map(async (file) => transform(await readFile(file, 'utf8'))));
  return pageMarkdown(sources, { site: site.url, page: slug ? `/${slug}` : '/' });
}

/** The address of a page's Markdown: its own `.md` on a site of several pages, `/llms.txt` on a site of one. */
export function markdownHref(slug: string): string {
  return pageSlugs().length > 1 ? `${site.url}/${slug || 'index'}.md` : `${site.url}/llms.txt`;
}

/**
 * A page's link preview: its own image in `public/og/` (`<slug>.png`, or `index.png` for every page
 * without one), or else the image the site's `app/routes/opengraph-image.tsx` draws, whose address
 * carries a hash of that route, so that a preview cached under the old drawing is fetched again once
 * the drawing changes. None when the site has neither.
 */
export async function ogImage(slug = ''): Promise<string | undefined> {
  for (const card of [slug || 'index', 'index']) if (existsSync(`public/og/${card}.png`)) return `${site.url}/og/${card}.png`;
  if (!existsSync('app/routes/opengraph-image.tsx')) return undefined;
  const hash = createHash('sha256').update(await readFile('app/routes/opengraph-image.tsx')).digest('hex').slice(0, 16);
  return `${site.url}/opengraph-image.png?${hash}`;
}

/**
 * A page's loader, for the site's `app/routes/page.tsx`: run at build time only, when the page is
 * rendered to a file, it gives the page as its meta tags and its shell need it, without its content,
 * which `<DocsPage>` loads itself (`loadPage`).
 */
export async function pageLoader({ params }: { params: { slug?: string } }): Promise<PageData> {
  const slug = params.slug ?? '';
  const page = source.getPage(slug ? [slug] : []);
  if (!page) throw new Response('Not found', { status: 404 });
  return {
    slug,
    path: page.path,
    title: page.data.title ?? '',
    description: page.data.description ?? '',
    tree: source.getPageTree(),
    image: await ogImage(slug),
    markdown: markdownHref(slug),
  };
}
