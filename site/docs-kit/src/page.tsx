// A docs page's route, the browser's half: `<DocsPage>` and `pageMeta`. The site's `app/routes/page.tsx`
// renders `<DocsPage>` with its own brand, MDX components and title-row extras, and takes its loader
// from `docs-kit/page.server` (README, "The page route"):
//
//   export async function loader(args: Route.LoaderArgs) { return pageLoader(args); }
//   export function meta(args: Route.MetaArgs) { return pageMeta(args); }
//   export default function Page({ loaderData }: Route.ComponentProps) {
//     return <DocsPage data={loaderData} brand={<Brand />} components={getMDXComponents()} />;
//   }

import browserCollections from 'collections/browser';
import type { Root } from 'fumadocs-core/page-tree';
import type { CompiledMDXProperties } from 'fumadocs-mdx';
import type { MDXComponents } from 'mdx/types';
import { use, useMemo, type ComponentProps, type ReactNode } from 'react';
import site from '@/docs.config';
import { DocsShell } from './components/shell';
import { siteMeta, structuredData, titleOf, urlOf } from './site';

/** What a page's loader gives its route (`pageLoader`, docs-kit/page.server). */
export type PageData = {
  /** The page's slug: `''` for the first page, `postgres` for `/postgres`. */
  slug: string;
  /** Its file in `content/docs`. */
  path: string;
  title: string;
  description: string;
  /** The page tree (`source.getPageTree()`), whose names are the pages' titles, plain strings. */
  tree: unknown;
  /** The link preview's address, when the site has one. */
  image?: string;
  /** The address of the page's Markdown: its `.md` on a site of several pages, `/llms.txt` on a site of one. */
  markdown: string;
};

/** A compiled MDX file of a page. */
export type PageFile = Pick<CompiledMDXProperties, 'default' | 'toc'>;

type Load = () => Promise<PageFile>;
const collections = browserCollections as unknown as { docs: { raw: Record<string, Load> }; sections?: { raw: Record<string, Load> } };

/** content/sections/, each a module of its own, by name, the order the first page shows them in. */
const sections = Object.entries(collections.sections?.raw ?? {})
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, load]) => load);

const loaded = new Map<string, Promise<PageFile[]>>();

/**
 * A page's files, compiled, in the order the page shows them: the page's own file, and for the first
 * page each file of `content/sections/` after it. Each is its own module, so an edit under the dev
 * server compiles one section. The promise is kept, so `use` finds the same one on every render.
 */
export function loadPage(path: string): Promise<PageFile[]> {
  let files = loaded.get(path);
  if (!files) {
    const own = collections.docs.raw[`./${path}`];
    if (!own) throw new Error(`content/docs/${path} is not a page`);
    files = Promise.all([own(), ...(path === 'index.mdx' ? sections.map((load) => load()) : [])]);
    loaded.set(path, files);
  }
  return files;
}

/** A page's meta tags (`siteMeta`), from what its loader gave. */
export function pageMeta({ loaderData }: { loaderData?: PageData }) {
  if (!loaderData) return [];
  const { slug, title, description, image, markdown } = loaderData;
  return siteMeta(site, { title: titleOf(site, slug, title), description, url: urlOf(site, slug), markdown, image, type: slug ? 'article' : 'website' });
}

type ShellProps = ComponentProps<typeof DocsShell>;

/**
 * A docs page: the shell (`DocsShell`) around the page's MDX, the site's footer, and on the first
 * page the structured data (`structuredData`). Its table of contents is the page's files' in order,
 * to the h3s.
 *
 * A link to a heading of the page (`#setup`, in the table of contents or the text) is a navigation to
 * React Router, which renders the route again on the `popstate` the browser fires: the whole page held
 * the main thread before the browser could paint the jump (Reylo's page: 270ms built, 1.1s under the
 * dev server). The page is the same, so the rendered tree is kept for as long as the route's data is,
 * and the jump is the browser's own. The other props are the route's own, so they never change while
 * its data stays the same.
 */
export function DocsPage({
  data,
  ...props
}: Omit<ShellProps, 'tree' | 'title' | 'toc' | 'github' | 'children'> & {
  /** The route's `loaderData`. */
  data: PageData;
  /** The MDX components (`docsMdxComponents` with the site's own). */
  components: MDXComponents;
  /** The title as drawn, in place of the page's own: a hero's. */
  title?: ReactNode;
}) {
  return useMemo(() => <PageContent data={data} {...props} />, [data]);
}

function PageContent({ data, components, title, before, footer, ...props }: Parameters<typeof DocsPage>[0]) {
  const files = use(loadPage(data.path));
  const json = data.slug ? undefined : structuredData(site, data.description);
  return (
    <DocsShell
      {...props}
      tree={data.tree as Root}
      title={title ?? data.title}
      toc={files.flatMap((file) => file.toc).filter((item) => item.depth <= 3)}
      github={site.repo}
      before={
        <>
          {json ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} /> : null}
          {before}
        </>
      }
      footer={footer ?? site.footer}
    >
      {files.map((file, i) => (
        <file.default key={i} components={components} />
      ))}
    </DocsShell>
  );
}
