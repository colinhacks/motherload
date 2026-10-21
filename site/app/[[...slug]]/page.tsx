import { source } from '@/lib/source';
import { Brand } from '@/components/brand';
import { getMDXComponents } from '@/components/mdx';
import { githubUrl, siteUrl } from '@/lib/site';
import { CopyAgentPrompt } from 'docs-kit/components';
import { DocsShell } from 'docs-kit/shell';
import { notFound } from 'next/navigation';

type Props = { params: Promise<{ slug?: string[] }> };

/**
 * The h2s whose h3s stay out of the table of contents: Setup's. The whole table fits one screen (a
 * window 900px tall, at Fumadocs' spacing), as on Reylo's site; with Setup's five h3s it ran 37px
 * over. Loaders keeps its h3s, one chip per extension. The headings stay on the page, with their
 * anchors.
 */
const FOLD = ['#setup'];

export default async function Page({ params }: Props) {
  const page = source.getPage((await params).slug ?? []);
  if (!page) notFound();
  const MDX = page.data.body;

  // docs-kit's page: no bar stays above it; the brand sits at the top of the table of contents on
  // the left, and the GitHub link, the "Leave a star!" note and the theme switch at its foot, or in
  // a row above the title where Fumadocs hides that column. "Copy agent prompt" at the right end of
  // the title's row copies the agent card at the top of Setup, as on Reylo's page (the maintainer,
  // 2026-10-20: "a copyable agent prompt for Motherload, the same way that we do for Reylo. Make it
  // visible, very visible at the top of the page"). The structured data describes the site and the
  // project; the page's metadata is the layout's (app/layout.tsx). The column ends on the licence.
  return (
    <DocsShell
      tree={source.getPageTree()}
      title={page.data.title}
      toc={page.data.toc}
      fold={FOLD}
      brand={<Brand />}
      github={githubUrl}
      titleAside={<CopyAgentPrompt />}
      before={<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData(page.data.description ?? '') }} />}
      footer={<>Released under the MIT License. Copyright © 2026 Colin McDonnell.</>}
    >
      <MDX components={getMDXComponents()} />
    </DocsShell>
  );
}

export function generateStaticParams() {
  return source.generateParams();
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
