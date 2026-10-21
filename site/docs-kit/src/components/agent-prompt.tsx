'use client';

import type { ReactNode } from 'react';

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
 * agents that's visually obvious". A card with a title and a note over the prompt, an ordinary code
 * block, copied with the code block's own copy icon or with `<CopyAgentPrompt>` at the top of the
 * page. The code block shows six lines and scrolls (style.css). It was folded behind a fade until the
 * maintainer, 2026-10-20: "it should just be a regular scrollable code block"; it had a Copy
 * instructions button of its own until the maintainer, 2026-10-21: "I don't think we need a big
 * 'Copy instructions' button, given that there's already a copy icon in the code block."
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
  return (
    <section className="dk-agent not-prose" aria-label="Setup instructions for a coding agent" data-agent-prompt="">
      <div className="dk-agent-head">
        <div>
          <p className="dk-agent-title">{title}</p>
          <p className="dk-agent-note">{note}</p>
        </div>
      </div>
      <div className="dk-agent-body">
        {children}
      </div>
    </section>
  );
}
