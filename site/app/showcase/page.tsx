import { showcase } from '@/lib/source';
import { Popup, PopupContent, PopupTrigger, ShowcaseRoot, Shot } from '@/components/showcase';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ComponentProps } from 'react';

/*
 * The showcase: the hero's imports (content/showcase/index.mdx), one split block each, main.ts on
 * the left and its file on the right, in a frame sized for a screenshot. Nothing on the site links
 * here, and search engines are asked not to index it.
 */

export const metadata: Metadata = {
  title: 'Showcase',
  robots: { index: false, follow: false },
};

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

export default function Page() {
  const page = showcase.get('index.mdx');
  if (!page) notFound();
  const MDX = page.body;
  return (
    <ShowcaseRoot>
      <MDX components={components} />
    </ShowcaseRoot>
  );
}
