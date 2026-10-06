import './global.css';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { Caveat, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import type { ReactNode } from 'react';

// IBM Plex, one family for text and code (the maintainer's choice of 2026-10-06).
const sans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-text',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
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
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable} ${hand.variable}`}>
      <body className="flex flex-col min-h-screen">
        <RootProvider search={{ enabled: false }}>{children}</RootProvider>
      </body>
    </html>
  );
}
