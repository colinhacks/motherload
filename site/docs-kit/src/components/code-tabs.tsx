import { CodeBlockTabsList, type CodeBlockTabs } from 'fumadocs-ui/components/codeblock';
import { Children, Fragment, cloneElement, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from 'react';
import { PrepaintCodeBlockTabs } from './prepaint';

type Element = ReactElement<{ value?: string; title?: string; children?: ReactNode }>;

/** The elements among `children`, with fragments opened: MDX wraps a tab's block in one. */
const elements = (children: ReactNode): Element[] =>
  (Children.toArray(children).filter(isValidElement) as Element[]).flatMap((child) => (child.type === Fragment ? elements(child.props.children) : [child]));

/**
 * Fumadocs' code-tab group (`CodeBlockTabs`, which remark-code-tab writes for consecutive blocks
 * with a `tab`), with one change: when every tab's block carries the same `title`, as
 * `title="get_user.sql" tab="Postgres"` blocks do, the file name moves to the right end of the tab
 * strip and leaves the blocks, so the group has one bar, the tabs on the left and the file on the
 * right, instead of the strip above a second bar with the name. Each block keeps its copy button,
 * which Fumadocs floats over the code of a block without a title. A group whose tabs carry
 * different titles, or none (a hero of `main.ts` beside the file it imports), is left as Fumadocs
 * draws it. A group whose choice is saved (`tab-group`) server-renders every panel, so that the
 * saved one shows from the first paint (./prepaint.tsx).
 */
export function CodeTabs({ children, className, ...props }: ComponentProps<typeof CodeBlockTabs>) {
  const saved = Boolean(props.groupId);
  const parts = elements(children).map((part) => (saved && part.props.value !== undefined ? cloneElement(part, { forceMount: true } as object) : part));
  const tabs = parts.filter((part) => part.props.value !== undefined);
  const blocks = tabs.map((tab) => elements(tab.props.children));
  const titles = new Set(blocks.map((inner) => (inner.length === 1 ? inner[0].props.title : undefined)));
  const [title] = titles;
  const classes = ['dk-code-tabs', className].filter(Boolean).join(' ');
  if (titles.size !== 1 || typeof title !== 'string' || title === '') {
    return <PrepaintCodeBlockTabs {...props} className={classes}>{parts}</PrepaintCodeBlockTabs>;
  }
  return (
    <PrepaintCodeBlockTabs {...props} className={classes} data-file={title}>
      {parts.map((part, i) => {
        if (part.props.value === undefined) {
          // The strip: Fumadocs' triggers, then the file name.
          return (
            <CodeBlockTabsList key={part.key ?? i}>
              {part.props.children}
              <span className="dk-code-tabs-file" aria-label={`File: ${title}`}>{title}</span>
            </CodeBlockTabsList>
          );
        }
        return cloneElement(part, { key: part.key ?? i }, elements(part.props.children).map((block, j) => cloneElement(block, { key: block.key ?? j, title: undefined })));
      })}
    </PrepaintCodeBlockTabs>
  );
}
