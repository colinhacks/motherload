'use client';

import { useEffect, useRef, useState } from 'react';
import { AGENT_PROMPT_SELECTOR, agentPromptText } from './agent-prompt';

/**
 * "Copy agent prompt" at the top of the page, on the title's row (`titleAside` of `DocsShell`), as
 * the maintainer asked on 2026-10-20 for Reylo's page: "the call to action with a 'Copy agent
 * prompt' button at the very top of the page. It can just be a button." It copies what the page's
 * agent card (`<AgentPrompt>`) copies, found in the page by its `data-agent-prompt`, so the prompt
 * is written once, in the card's code block. A page without a card shows no button.
 */
export function CopyAgentPrompt({ label = 'Copy agent prompt' }: { label?: string }) {
  const [missing, setMissing] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Rendered on the server, so a page with a card shows the button from the first paint; one
  // without a card drops it once it has hydrated.
  useEffect(() => {
    setMissing(!document.querySelector(AGENT_PROMPT_SELECTOR));
    return () => clearTimeout(timer.current);
  }, []);

  async function copy() {
    const card = document.querySelector(AGENT_PROMPT_SELECTOR);
    if (!card) return;
    await navigator.clipboard.writeText(agentPromptText(card));
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  }

  if (missing) return null;
  // Both labels share one grid cell, the other one hidden, as on the card's Copy button, so
  // "Copied" keeps the button's width and moves nothing.
  return (
    <button type="button" className="dk-cta" onClick={copy}>
      <span data-shown={!copied || undefined}>
        <Icon path={CLIPBOARD} />
        {label}
      </span>
      <span data-shown={copied || undefined} aria-live="polite">
        <Icon path={CHECK} />
        Copied
      </span>
    </button>
  );
}

// Lucide's clipboard and check.
const CLIPBOARD = 'M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1ZM16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2';
const CHECK = 'M20 6 9 17l-5-5';

function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}
