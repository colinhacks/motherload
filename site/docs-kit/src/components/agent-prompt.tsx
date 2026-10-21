'use client';

import { useRef, useState, type ReactNode } from 'react';

/** The selector of an agent card (its `data-agent-prompt`), by which `<CopyAgentPrompt>` finds the card it copies. */
export const AGENT_PROMPT_SELECTOR = '[data-agent-prompt]';

/**
 * The prompt an agent card holds, as plain text: its code block's lines, as Shiki writes them (one
 * `.line` element each). The card's Copy button and `<CopyAgentPrompt>` at the top of the page both
 * copy this, so the prompt is written once, in the page's code block.
 */
export function agentPromptText(card: Element): string {
  const lines = [...card.querySelectorAll('pre .line')].map((line) => line.textContent ?? '');
  return lines.join('\n').trimEnd() + '\n';
}

/**
 * The instructions a coding agent follows to set the product up in a project, as the maintainer
 * asked on 2026-10-20 for Reylo's Setup: "some kind of complete, copyable instruction block for
 * agents that's visually obvious". A card with one Copy button, which copies the whole prompt (the
 * code block given as children, as plain text), and the prompt below it as an ordinary code block,
 * which scrolls where it is taller than a code block may be. It was folded to its first lines behind
 * a fade with a control to open it until the maintainer, 2026-10-20: "I don't like the fade-out CSS/
 * animation you have on the agent instructions block. it should just be a regular scrollable code
 * block. The user can skim through it if they want, but the expand and collapse are not necessary."
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
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!body.current) return;
    await navigator.clipboard.writeText(agentPromptText(body.current));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section className="dk-agent not-prose" aria-label="Setup instructions for a coding agent" data-agent-prompt="">
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
      <div ref={body} className="dk-agent-body">
        {children}
      </div>
    </section>
  );
}
