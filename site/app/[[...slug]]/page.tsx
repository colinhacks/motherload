import { source } from '@/lib/source';
import { Brand, githubUrl } from '@/components/brand';
import { getMDXComponents } from '@/components/mdx';
import { DocsShell } from 'docs-kit/shell';
import type { Metadata } from 'next';
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
  // a row above the title where Fumadocs hides that column.
  return (
    <DocsShell tree={source.getPageTree()} title={page.data.title} toc={page.data.toc} fold={FOLD} brand={<Brand />} github={githubUrl}>
      <MDX components={getMDXComponents()} />
    </DocsShell>
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
