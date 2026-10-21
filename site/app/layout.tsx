import './global.css';
import { DocsRoot } from 'docs-kit/root';
import { Caveat, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { siteTitle, siteUrl } from '@/lib/site';
import { source } from '@/lib/source';

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

// The page's metadata, as Reylo's site gives it: the title, the frontmatter's description, and the
// link previews, whose image is app/opengraph-image.tsx. It lives here rather than on the page
// because Next.js replaces an inherited `openGraph` or `alternates` whole: a page that set its own
// would drop the image Next.js attaches at this level. The icons are app/icon.svg, app/favicon.ico
// and app/apple-icon.png, which Next.js links itself; the showcase (app/showcase/page.tsx) sets its
// own title and asks not to be indexed.
export function generateMetadata(): Metadata {
  const description = source.getPage([])?.data.description;
  return {
    metadataBase: new URL(siteUrl),
    title: siteTitle,
    description,
    applicationName: 'Motherload',
    authors: [{ name: 'Colin McDonnell', url: 'https://github.com/colinhacks' }],
    creator: 'Colin McDonnell',
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
    alternates: { canonical: '/', types: { 'text/markdown': '/llms.txt' } },
    openGraph: { type: 'website', url: '/', siteName: 'Motherload', locale: 'en_US', title: siteTitle, description },
    twitter: { card: 'summary_large_image', creator: '@colinhacks', title: siteTitle, description },
  };
}

export default function Layout({ children }: { children: ReactNode }) {
  return <DocsRoot className={`${sans.variable} ${mono.variable} ${hand.variable}`}>{children}</DocsRoot>;
}
