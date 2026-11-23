import { useEffect } from 'react';

/**
 * Keeps the table of contents' active entry in view when the column is taller than the window.
 * The column (`#nd-toc`) scrolls on its own; Fumadocs' auto-scroll aims at an inner area that never
 * scrolls, so a long page's last entries went below the window's edge while their sections were
 * read. This watches the entries Fumadocs marks active (`data-active`) and scrolls the column just
 * far enough to show them, a margin from its edge. It reads no scroll position of the page and never
 * moves the page: only the column follows, when the active entry changes.
 */
export function TocFollow() {
  useEffect(() => {
    const toc = document.getElementById('nd-toc');
    if (!toc) return;
    const margin = 48;
    const follow = () => {
      if (toc.scrollHeight <= toc.clientHeight) return;
      const active = [...toc.querySelectorAll<HTMLElement>('a[data-active="true"]')];
      if (!active.length) return;
      const box = toc.getBoundingClientRect();
      const first = active[0]!.getBoundingClientRect();
      const last = active[active.length - 1]!.getBoundingClientRect();
      if (last.bottom > box.bottom - margin) toc.scrollBy({ top: last.bottom - box.bottom + margin, behavior: 'smooth' });
      else if (first.top < box.top + margin) toc.scrollBy({ top: first.top - box.top - margin, behavior: 'smooth' });
    };
    const observer = new MutationObserver(follow);
    observer.observe(toc, { subtree: true, attributes: true, attributeFilter: ['data-active'] });
    follow();
    return () => observer.disconnect();
  }, []);
  return null;
}
