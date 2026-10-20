import './global.css';
import { DocsRoot } from 'docs-kit/root';
import { Caveat, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import type { ReactNode } from 'react';

// IBM Plex, one family for text and code (the maintainer's choice of 2026-10-06).
//
// `display: 'optional'`, not 'swap', so a font that arrives after the first paint does not rewrap
// the text (a layout shift, measured on Reylo's page on 2026-10-20). The files are preloaded, so
// they make the first paint on any ordinary connection; a first view whose fonts take longer keeps
// the fallbacks, and the next view has them cached. Plex Mono's fallback is the system's monospace,
// listed, not the Arial next/font would adjust to it (under Turbopack `adjustFontFallback: false`
// alone kept the Arial face).
const sans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'optional',
  variable: '--font-text',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'optional',
  adjustFontFallback: false,
  fallback: ['ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
  variable: '--font-code',
});

// A handwriting face, as on nub's docs, for the "Leave a star!" note under the GitHub link only.
const hand = Caveat({
  subsets: ['latin'],
  weight: ['600'],
  display: 'swap',
  variable: '--font-hand',
});

export const metadata = {
  title: 'Motherload',
  description: 'Import a TOML, YAML, JSON5, JSONC, CSV, TSV, Markdown, text or .env file and get a typed module. Import a JSON Schema and get its type and a validator.',
};

export default function Layout({ children }: { children: ReactNode }) {
  return <DocsRoot className={`${sans.variable} ${mono.variable} ${hand.variable}`}>{children}</DocsRoot>;
}
