import type { ReactNode } from 'react';

/**
 * A detail the reader can open, drawn quietly: a muted line with a chevron, and the opened text set
 * off by a thin rule on its left. Fumadocs' accordion is a bordered card, which reads as the most
 * important thing on the page; this "looks more like a detailed summary thing so that it doesn't
 * seem so visually important" (the maintainer, 2026-10-11).
 *
 * A native `<details>`, so it opens without JavaScript and the browser's find-in-page opens it. The
 * `id` goes on the summary, inside the `<details>`: a link to `#id` then opens it, because a
 * fragment's target inside a closed `<details>` opens it. The summary is a string attribute, so
 * that `remarkSections` can read it from the source; a part of it between backticks is code, as in
 * Markdown.
 */
export function Details({ summary, id, children }: { summary: string; id?: string; children: ReactNode }) {
  const parts = summary.split('`').map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part));
  return (
    <details className="dk-details">
      <summary id={id}>
        <span>{parts}</span>
      </summary>
      <div className="dk-details-body">{children}</div>
    </details>
  );
}
