import { use } from 'react';
import browserCollections from 'collections/browser';
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { ComponentProps } from 'react';
import type { Route } from './+types/showcase';
import { Popup, PopupContent, PopupTrigger, ShowcaseRoot, Shot } from '@/components/showcase';
import { siteMeta } from '@/lib/meta';
import { ogHash } from '@/lib/og.server';
import { source } from '@/lib/source';

/*
 * The showcase: the hero's imports (content/showcase/index.mdx), one split block each, main.ts on
 * the left and its file on the right, in a frame sized for a screenshot. Nothing on the site links
 * here, and search engines are asked not to index it.
 */

/** Run at build time only: the page's description and the link preview's hash, for the meta tags. */
export async function loader() {
  return { description: source.getPage([])?.data.description ?? '', og: await ogHash() };
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  return loaderData ? siteMeta(loaderData.description, loaderData.og, { title: 'Showcase', index: false }) : [];
}

const components = {
  ...defaultMdxComponents,
  // No copy button: it shows while the pointer is over a block, so it would be in the screenshot.
  pre: (props: ComponentProps<'pre'>) => (
    <CodeBlock {...props} allowCopy={false}>
      <Pre>{props.children}</Pre>
    </CodeBlock>
  ),
  Popup,
  PopupContent,
  PopupTrigger,
  Shot,
};

// The showcase's one file, a module of its own, fetched once; while it loads during hydration,
// React keeps the prerendered page.
let loading: ReturnType<(typeof browserCollections.showcase.raw)[string]> | undefined;

export default function Showcase() {
  const { default: MDX } = use((loading ??= browserCollections.showcase.raw['./index.mdx']!()));
  return (
    <ShowcaseRoot>
      <MDX components={components} />
    </ShowcaseRoot>
  );
}
