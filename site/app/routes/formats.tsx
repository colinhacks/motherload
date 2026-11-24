import type { Root } from 'fumadocs-core/page-tree';
import { use } from 'react';
import browserCollections from 'collections/browser';
import { DocsShell } from 'docs-kit/shell';
import { ogImage, source } from 'docs-kit/page.server';
import { siteMeta } from 'docs-kit/site';
import type { Route } from './+types/formats';
import { Brand } from '@/components/brand';
import site from '@/docs.config';
import { getMDXComponents } from '@/components/mdx';

/*
 * Every format (content/formats/index.mdx): one main.ts that imports every file type Motherload
 * reads, in the docs page's own shell, so the block looks as the hero does, for screenshots. The
 * maintainer asked for it on 2026-10-20: "some other page, not intended for public viewing, that
 * just contains a code block like the one I'm attaching, with an example of importing every single
 * supported file type". Nothing on the site links here, and search engines are asked not to index it.
 */

/** Run at build time only: the page tree for the shell, and the meta tags' description and link preview. */
export async function loader() {
  return { description: source.getPage([])?.data.description ?? '', tree: source.getPageTree(), image: await ogImage() };
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  return loaderData ? siteMeta(site, { title: 'Every format', description: loaderData.description, url: site.url, markdown: `${site.url}/llms.txt`, image: loaderData.image, index: false }) : [];
}

// The page's one file, a module of its own, fetched once; while it loads during hydration, React
// keeps the prerendered page.
let loading: ReturnType<(typeof browserCollections.formats.raw)[string]> | undefined;

export default function Formats({ loaderData }: Route.ComponentProps) {
  const { default: MDX, toc } = use((loading ??= browserCollections.formats.raw['./index.mdx']!()));
  return (
    <DocsShell tree={loaderData.tree as Root} title="Every format" toc={toc} brand={<Brand />} github={site.repo}>
      <MDX components={getMDXComponents()} />
    </DocsShell>
  );
}
