import { source } from '@/lib/source';
import { TocFooter, TocHeader, TopRow } from '@/components/chrome';
import { getMDXComponents } from '@/components/mdx';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { DocsBody, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page';
import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { notFound } from 'next/navigation';

type Props = { params: Promise<{ slug?: string[] }> };

// Fumadocs' docs grid with the table of contents moved to the left, where the sidebar tree would
// be: this site is one page, so it has no tree. The areas and columns are Fumadocs' own
// (fumadocs-ui/dist/layouts/docs/slots/container.js) with `toc` and `sidebar` swapped.
const LEFT_TOC = {
  gridTemplate: `"toc toc header sidebar sidebar"
"toc toc toc-popover sidebar sidebar"
"toc toc main sidebar sidebar" 1fr / minmax(min-content, 1fr) var(--fd-toc-width) minmax(0, calc(var(--fd-layout-width) - var(--fd-sidebar-width) - var(--fd-toc-width))) var(--fd-sidebar-col) minmax(min-content, 1fr)`,
  '--fd-layout-width': '78rem',
} as CSSProperties;

export default async function Page({ params }: Props) {
  const page = source.getPage((await params).slug ?? []);
  if (!page) notFound();
  const MDX = page.data.body;

  return (
    // No bar stays above the page: the name, the repository and the theme switch sit in the left
    // column around the table of contents, or in `TopRow` where Fumadocs hides that column.
    <DocsLayout tree={source.getPageTree()} sidebar={{ enabled: false }} nav={{ enabled: false }} containerProps={{ style: LEFT_TOC }}>
      <TopRow />
      <DocsPage
        toc={page.data.toc}
        tableOfContent={{
          style: 'clerk',
          header: <TocHeader />,
          footer: <TocFooter />,
          container: { className: 'justify-self-end ps-4 pt-8' },
        }}
        breadcrumb={{ enabled: false }}
        footer={{ enabled: false }}
      >
        <DocsTitle>{page.data.title}</DocsTitle>
        <DocsBody>
          <MDX components={getMDXComponents()} />
        </DocsBody>
      </DocsPage>
    </DocsLayout>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = source.getPage((await params).slug ?? []);
  if (!page) notFound();
  return { title: page.data.title, description: page.data.description };
}
