import type { ReactNode } from 'react';

const info = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
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
 * the text below it at nearly body size. In place of Fumadocs' callout, a shadowed card with a thin
 * bar inside its own border, a blue icon and small grey text, which the maintainer rejected on
 * 2026-10-21 ("I hate this so much"), and chose this from a dozen mockups ("I like option C. It's
 * really good"). It takes Fumadocs' props, so a page's `<Callout>` and `<Callout title>` keep
 * working; a part of a title between backticks is code, as in Markdown.
 */
export function Callout({ title, type = 'info', children }: { title?: string; type?: 'info' | 'idea' | 'success' | 'warn' | 'warning' | 'error'; children: ReactNode }) {
  const warns = type === 'warn' || type === 'warning' || type === 'error';
  const label = title ?? (warns ? 'Warning' : 'Note');
  const parts = label.split('`').map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part));
  return (
    <aside className="dk-callout" data-type={warns ? 'warning' : 'info'}>
      <div className="dk-callout-head">
        {warns ? warning : info}
        <span>{parts}</span>
      </div>
      <div className="dk-callout-body">{children}</div>
    </aside>
  );
}
