// The one copy icon and the one check every copy button of the page draws: the heading's, the code
// block's and "Copy agent prompt" (Lucide's copy and check). The code blocks drew Fumadocs'
// clipboard and the headings this copy, two icons for one act.

const ICON = { viewBox: '0 0 24 24', width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

export function CopyIcon() {
  return (
    <svg {...ICON}>
      <rect width="14" height="14" x="8" y="8" rx="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg {...ICON}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
