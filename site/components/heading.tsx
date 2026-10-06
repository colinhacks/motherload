'use client';

import { useState, type ComponentPropsWithoutRef, type ReactNode } from 'react';

type Props = ComponentPropsWithoutRef<'h2'> & { as: 'h2' | 'h3' | 'h4'; 'data-section'?: string };

const ICON = { viewBox: '0 0 24 24', width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

const linkIcon = (
  <svg {...ICON}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const copyIcon = (
  <svg {...ICON}>
    <rect width="14" height="14" x="8" y="8" rx="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

const checkIcon = (
  <svg {...ICON}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

/** A button that copies `text()` to the clipboard and shows a check for a moment. */
function CopyButton({ label, icon, text }: { label: string; icon: ReactNode; text: () => string }) {
  const [copied, setCopied] = useState(false);
  const copy = () =>
    void navigator.clipboard.writeText(text()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  return (
    <button type="button" className="ml-action" aria-label={label} title={label} onClick={copy}>
      {copied ? checkIcon : icon}
    </button>
  );
}

/**
 * A section heading with two buttons at the right end of its line, always shown in a light gray:
 * one copies the section's URL and puts its anchor in the address bar, the other copies the
 * section as Markdown (lib/remark-sections.ts), to paste into an agent. The heading text is plain
 * text, not a link, so it carries none of the link underline.
 */
export function Heading({ as: As, id, children, className, 'data-section': section, ...props }: Props) {
  if (!id) return <As className={className} {...props}>{children}</As>;
  const url = () => {
    const url = new URL(window.location.href);
    url.hash = id;
    history.replaceState(null, '', url);
    return url.href;
  };
  return (
    <As id={id} className={['ml-heading', className].filter(Boolean).join(' ')} {...props}>
      <span className="ml-heading-text">{children}</span>
      <span className="ml-heading-actions not-prose">
        <CopyButton label="Copy a link to this section" icon={linkIcon} text={url} />
        {section && <CopyButton label="Copy this section as Markdown" icon={copyIcon} text={() => section} />}
      </span>
    </As>
  );
}
