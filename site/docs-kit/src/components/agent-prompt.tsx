'use client';

import type { ReactNode } from 'react';
import { Callout } from './callout';

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
 * agents that's visually obvious". A standard callout (./callout.tsx) titled for the product, a note,
 * then the prompt, an ordinary code block, copied with the code block's own copy icon or with
 * `<CopyAgentPrompt>` at the top of the page; the code block shows six lines and scrolls (style.css).
 * It was a card of its own until the maintainer, 2026-10-21: "this prompt for the agent ... doesn't
 * look like a normal callout. Is this a custom component? You should just use a standard callout
 * component." The wrapper carries `data-agent-prompt`, by which `<CopyAgentPrompt>` finds it.
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
    <div className="dk-agent" aria-label="Setup instructions for a coding agent" data-agent-prompt="">
      <Callout title={title}>
        <p>{note}</p>
        {children}
      </Callout>
    </div>
  );
}
