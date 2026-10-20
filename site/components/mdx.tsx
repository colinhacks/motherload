import { docsMdxComponents } from 'docs-kit/components';
import type { MDXComponents } from 'mdx/types';

/**
 * docs-kit's components: headings with the link icon in the margin and the copy-as-Markdown
 * button, accordions, tabs, `<Details>`, code tabs and Twoslash's popups.
 */
export function getMDXComponents(components?: MDXComponents) {
  return docsMdxComponents(components);
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
