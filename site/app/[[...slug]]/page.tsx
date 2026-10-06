import { source } from '@/lib/source';
import { Header } from '@/components/header';
import { getMDXComponents } from '@/components/mdx';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page';
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
    // The bar above the layout takes the place Fumadocs reserves for a banner, so the sticky
    // table of contents starts below it.
    <div className="[--fd-banner-height:--spacing(14)]">
      <Header />
      <DocsLayout tree={source.getPageTree()} sidebar={{ enabled: false }} nav={{ enabled: false }} containerProps={{ style: LEFT_TOC }}>
        <DocsPage
          toc={page.data.toc}
          tableOfContent={{ style: 'clerk', container: { className: 'justify-self-end ps-4' } }}
          breadcrumb={{ enabled: false }}
          footer={{ enabled: false }}
        >
          <DocsTitle>{page.data.title}</DocsTitle>
          <DocsDescription>{page.data.description}</DocsDescription>
          <DocsBody>
            <MDX components={getMDXComponents()} />
          </DocsBody>
        </DocsPage>
      </DocsLayout>
    </div>
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
