import { docsMdxComponents } from 'docs-kit/components';
import type { MDXComponents } from 'mdx/types';
import { HowItWorksDiagram } from './how-it-works-diagram';

/**
 * docs-kit's components (headings with the link icon in the margin and the copy-as-Markdown
 * button, accordions, tabs, `<Details>`, code tabs and Twoslash's popups) and Motherload's own.
 */
export function getMDXComponents(components?: MDXComponents) {
  return docsMdxComponents({
    // The figure under How it works (components/how-it-works-diagram.tsx).
    HowItWorksDiagram,
    ...components,
  });
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
