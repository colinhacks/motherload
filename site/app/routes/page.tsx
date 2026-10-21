import type { Root } from 'fumadocs-core/page-tree';
import { use, useMemo } from 'react';
import { CopyAgentPrompt } from 'docs-kit/components';
import { DocsShell } from 'docs-kit/shell';
import type { Route } from './+types/page';
import { Brand } from '@/components/brand';
import { getMDXComponents } from '@/components/mdx';
import { loadPage } from '@/lib/content';
import { siteMeta } from '@/lib/meta';
import { ogHash } from '@/lib/og.server';
import { githubUrl, siteUrl } from '@/lib/site';
import { source } from '@/lib/source';

/**
 * The h2s whose h3s stay out of the table of contents: Setup's. The whole table fits one screen (a
 * window 900px tall, at Fumadocs' spacing), as on Reylo's site; with Setup's five h3s it ran 37px
 * over. Loaders keeps its h3s, one chip per extension. The headings stay on the page, with their
 * anchors.
 */
const FOLD = ['#setup'];

/**
 * Run at build time only, when the page is rendered to a file (react-router.config.ts): the page
 * as the meta tags and the shell need it, without its content, which the component loads itself
 * (lib/content.ts).
 */
export async function loader({ params }: Route.LoaderArgs) {
  const page = source.getPage(params.slug ? [params.slug] : []);
  if (!page) throw new Response('Not found', { status: 404 });
  return { path: page.path, title: page.data.title, description: page.data.description ?? '', tree: source.getPageTree(), og: await ogHash() };
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  return loaderData ? siteMeta(loaderData.description, loaderData.og) : [];
}

/**
 * A link to a heading of the page (`#setup`, in the table of contents or the text) is a navigation
 * to React Router, which renders the route again on the `popstate` the browser fires: the whole
 * page held the main thread before the browser could paint the jump (Reylo's page, which this one
 * shares its layout with: 270ms built, 1.1s under the dev server). The page is the same, so the
 * rendered tree is kept for as long as the route's data is, and the jump is the browser's own.
 */
export default function Page({ loaderData }: Route.ComponentProps) {
  return useMemo(() => <PageContent loaderData={loaderData} />, [loaderData]);
}

function PageContent({ loaderData }: Pick<Route.ComponentProps, 'loaderData'>) {
  const { path, title, description, tree } = loaderData;
  const files = use(loadPage(path));
  const components = getMDXComponents();

  // docs-kit's page: no bar stays above it; the brand sits at the top of the table of contents on
  // the left, and the GitHub link, the "Leave a star!" note and the theme switch at its foot, or in
  // a row above the title where Fumadocs hides that column. The page is content/docs/index.mdx and
  // then each section of content/sections/, each a module of its own, and the table of contents is
  // theirs in order. "Copy agent prompt" at the right end of the title's row copies the agent card
  // at the top of Setup, as on Reylo's page (the maintainer, 2026-10-20: "a copyable agent prompt
  // for Motherload, the same way that we do for Reylo. Make it visible, very visible at the top of
  // the page"). The structured data describes the site and the project; the page's metadata is
  // `meta` above. The column ends on the licence.
  return (
    <DocsShell
      // The tree's names are the pages' titles, plain strings, so it reaches the browser as it is.
      tree={tree as Root}
      title={title}
      toc={files.flatMap((file) => file.toc)}
      fold={FOLD}
      brand={<Brand />}
      github={githubUrl}
      titleAside={<CopyAgentPrompt />}
      before={<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData(description) }} />}
      footer={<>Released under the MIT License. Copyright © 2026 Colin McDonnell.</>}
    >
      {files.map((file, i) => (
        <file.default key={i} components={components} />
      ))}
    </DocsShell>
  );
}

/**
 * The site and the project as schema.org data, as Reylo's page gives them: the WebSite gives search
 * results the site's name, and the SoftwareSourceCode says what the page is about and where its
 * code lives.
 */
function structuredData(description: string): string {
  const author = { '@type': 'Person', name: 'Colin McDonnell', url: 'https://github.com/colinhacks' };
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': `${siteUrl}/#website`, url: `${siteUrl}/`, name: 'Motherload', description, inLanguage: 'en' },
      {
        '@type': 'SoftwareSourceCode',
        '@id': `${siteUrl}/#software`,
        name: 'Motherload',
        description,
        url: `${siteUrl}/`,
        codeRepository: githubUrl,
        programmingLanguage: 'TypeScript',
        runtimePlatform: 'Node.js',
        license: 'https://opensource.org/licenses/MIT',
        author,
        isPartOf: { '@id': `${siteUrl}/#website` },
      },
    ],
  };
  // `<` is escaped so that no string in the data can close the script element.
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
