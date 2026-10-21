import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import * as Twoslash from 'fumadocs-twoslash/ui';
import type { MDXComponents } from 'mdx/types';
import type { ComponentProps } from 'react';
import { CodeTabs } from './code-tabs';
import { Details } from './details';
import { Heading } from './heading';

const cx = (...names: (string | undefined)[]) => names.filter(Boolean).join(' ');

/**
 * The MDX components every page gets: Fumadocs' defaults; headings with the link icon in the left
 * margin and the copy-as-Markdown button (./heading.tsx); Fumadocs' accordions (drawn as filled bars) and tabs; the quiet
 * `<Details>`; code-tab groups that put a shared file name at the end of the strip
 * (./code-tabs.tsx); and Twoslash's popups, opening fast. A site spreads its own components over
 * these (its variant tabs, its agent card with its title, its figures).
 */
export function docsMdxComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    h2: (props) => <Heading as="h2" {...props} />,
    h3: (props) => <Heading as="h3" {...props} />,
    h4: (props) => <Heading as="h4" {...props} />,
    // Fumadocs' accordions, marked for the stylesheet's filled bars (style.css, "Accordions").
    Accordion: (props: ComponentProps<typeof Accordion>) => <Accordion {...props} className={cx('dk-accordion', props.className)} />,
    Accordions: (props: ComponentProps<typeof Accordions>) => <Accordions {...props} className={cx('dk-accordions', props.className)} />,
    Details,
    Tab,
    Tabs,
    CodeBlockTabs: CodeTabs,
    // The hover popups of `ts twoslash` blocks.
    ...Twoslash,
    // Fumadocs waits 300ms before it opens a popup and as long before it closes one. 60ms opens it
    // as soon as the pointer settles on a name, and still leaves time to move into the popup.
    Popup: (props: ComponentProps<typeof Twoslash.Popup>) => <Twoslash.Popup {...props} delay={60} />,
    ...components,
  } satisfies MDXComponents;
}
