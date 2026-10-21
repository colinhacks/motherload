'use client';

import { useState, type MouseEvent } from 'react';
import { CheckIcon, CopyIcon } from './copy-icons';

/**
 * A code block's copy button, in place of Fumadocs' (./mdx.tsx): the same place and look, with the
 * page's one copy icon and a tooltip, as the heading's copy button has. It copies what Fumadocs'
 * copied: the block's text, with each `.nd-copy-ignore` (a Twoslash popup's text) as a line break.
 */
export function CodeCopyButton() {
  const [copied, setCopied] = useState(false);
  const copy = (event: MouseEvent<HTMLButtonElement>) => {
    const pre = event.currentTarget.closest('figure')?.querySelector('pre');
    if (!pre) return;
    const clone = pre.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.nd-copy-ignore').forEach((node) => node.replaceWith('\n'));
    void navigator.clipboard.writeText(clone.textContent ?? '').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      type="button"
      className="dk-code-copy inline-flex items-center justify-center rounded-md p-1 transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring hover:text-fd-accent-foreground data-checked:text-fd-accent-foreground"
      data-checked={copied || undefined}
      aria-label={copied ? 'Copied' : 'Copy code'}
      title="Copy code"
      onClick={copy}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}
