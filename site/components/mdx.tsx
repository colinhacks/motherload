import { AgentPrompt, docsMdxComponents } from 'docs-kit/components';
import type { MDXComponents } from 'mdx/types';
import type { ReactNode } from 'react';
import { HowItWorksDiagram } from './how-it-works-diagram';

/**
 * docs-kit's components (headings with the link icon in the margin and the copy-as-Markdown
 * button, accordions, tabs, `<Details>`, code tabs and Twoslash's popups) and Motherload's own.
 */
export function getMDXComponents(components?: MDXComponents) {
  return docsMdxComponents({
    // The setup instructions for a coding agent at the top of Setup, which "Copy agent prompt" on
    // the title's row copies too (app/[[...slug]]/page.tsx).
    AgentPrompt: ({ children }: { children: ReactNode }) => <AgentPrompt title="Set up Motherload with an agent">{children}</AgentPrompt>,
    // The figure under How it works (components/how-it-works-diagram.tsx).
    HowItWorksDiagram,
    ...components,
  });
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
