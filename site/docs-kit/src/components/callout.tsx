import type { ReactNode } from 'react';

const lightbulb = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
    <path d="M9 18h6" />
    <path d="M10 22h4" />
  </svg>
);

const warning = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);

/**
 * A note set apart from the prose: a flat card whose header bar, ruled off like a code block's
 * title bar, holds an amber icon and the label (the title, or "Note"; "Warning" for a warning), and
 * the text below it two sizes under the body's and a step dimmer, so it reads as an aside. In place
 * of Fumadocs' callout, a shadowed card with a thin bar inside its own border, a blue icon and small
 * grey text, which the maintainer rejected on 2026-10-21. A note's icon is a lightbulb: an amber
 * circled "i" read as an exclamation mark, a warning, and amber on a lightbulb reads as light. It
 * takes Fumadocs' props, so a page's `<Callout>` and `<Callout title>` keep working; a part of a
 * title between backticks is code, as in Markdown.
 */
export function Callout({ title, type = 'info', children }: { title?: string; type?: 'info' | 'idea' | 'success' | 'warn' | 'warning' | 'error'; children: ReactNode }) {
  const warns = type === 'warn' || type === 'warning' || type === 'error';
  const label = title ?? (warns ? 'Warning' : 'Note');
  const parts = label.split('`').map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part));
  return (
    <aside className="dk-callout" data-type={warns ? 'warning' : 'info'}>
      <div className="dk-callout-head">
        {warns ? warning : lightbulb}
        <span>{parts}</span>
      </div>
      <div className="dk-callout-body">{children}</div>
    </aside>
  );
}
