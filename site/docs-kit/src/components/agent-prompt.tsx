'use client';

import { useRef, useState, type ReactNode } from 'react';

/**
 * The instructions a coding agent follows to set the product up in a project, as the maintainer
 * asked on 2026-10-20 for Reylo's Setup: "some kind of complete, copyable instruction block for
 * agents that's visually obvious". A card with one Copy button, which copies the whole prompt (the
 * code block given as children, as plain text), and the prompt below it, folded to its first lines
 * until it is opened.
 */
export function AgentPrompt({
  title,
  note = 'Paste these instructions into Claude Code, Codex, Cursor or any coding agent.',
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  const body = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    // The code block's lines, as Shiki writes them: one `.line` element each.
    const lines = [...(body.current?.querySelectorAll('pre .line') ?? [])].map((line) => line.textContent ?? '');
    await navigator.clipboard.writeText(lines.join('\n').trimEnd() + '\n');
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section className="dk-agent not-prose" aria-label="Setup instructions for a coding agent">
      <div className="dk-agent-head">
        <div>
          <p className="dk-agent-title">{title}</p>
          <p className="dk-agent-note">{note}</p>
        </div>
        {/* Both labels share one grid cell, the other one hidden, so the button keeps the width of the
            longer: a narrower "Copied" moved the button by 72px and, on a phone, rewrapped the note. */}
        <button type="button" className="dk-agent-copy" onClick={copy}>
          <span data-shown={!copied || undefined}>Copy instructions</span>
          <span data-shown={copied || undefined}>Copied</span>
        </button>
      </div>
      <div ref={body} className="dk-agent-body" data-open={open || undefined}>
        {children}
      </div>
      {/* Kept under the pointer when it folds the instructions above it (KEEP_IN_PLACE_SCRIPT). */}
      <button type="button" className="dk-agent-toggle" onClick={() => setOpen(!open)} aria-expanded={open} data-keep-in-place={open || undefined}>
        {open ? 'Show less' : 'Show the instructions'}
      </button>
    </section>
  );
}
