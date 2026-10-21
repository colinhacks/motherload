import './global.css';
import { DocsDocument } from 'docs-kit/document';
import type { ReactNode } from 'react';
import { isRouteErrorResponse, Outlet } from 'react-router';
import type { Route } from './+types/root';
import caveatLatin from '../assets/fonts/caveat-latin.woff2?url';
import mono400Latin from '../assets/fonts/ibm-plex-mono-400-latin.woff2?url';
import mono500Latin from '../assets/fonts/ibm-plex-mono-500-latin.woff2?url';
import mono600Latin from '../assets/fonts/ibm-plex-mono-600-latin.woff2?url';
import sansLatin from '../assets/fonts/ibm-plex-sans-latin.woff2?url';
import { NotFound } from '@/components/not-found';

// The fonts (app/fonts.css): IBM Plex Sans and IBM Plex Mono, and Caveat for the "Leave a star!"
// note, the files next/font served until the site left Next.js, with the same faces:
// `font-display: optional` for Plex, so a font that arrives after the first paint does not rewrap
// the text (a layout shift, measured on Reylo's page on 2026-10-20), Plex Sans's size-adjusted
// fallback, and the system's monospace behind Plex Mono. Their Latin files are preloaded, so they
// make the first paint on any ordinary connection; a first view whose fonts take longer keeps the
// fallbacks, and the next view has them cached. The icons are the gold bars: public/favicon.ico,
// public/icon.svg and public/apple-icon.png.
export const links: Route.LinksFunction = () => [
  ...[sansLatin, mono600Latin, mono400Latin, caveatLatin, mono500Latin].map((href) => ({ rel: 'preload', href, as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' as const })),
  { rel: 'author', href: 'https://github.com/colinhacks' },
  { rel: 'manifest', href: '/manifest.webmanifest' },
  { rel: 'icon', href: '/favicon.ico', sizes: '48x48', type: 'image/x-icon' },
  { rel: 'icon', href: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
  { rel: 'apple-touch-icon', href: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
];

// docs-kit's document: Fumadocs' provider, and the head scripts that show a saved tab choice from
// the first paint and keep a pressed tab under the pointer.
export function Layout({ children }: { children: ReactNode }) {
  return <DocsDocument>{children}</DocsDocument>;
}

export default function App() {
  return <Outlet />;
}

// What a failed navigation shows: the missing-address page for a 404 (a link to a page the site
// does not have), and the status for anything else, with the error itself in `vite dev`.
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error)) return <NotFound status={error.status} text={error.status === 404 ? undefined : error.statusText || 'This page could not be shown.'} />;
  return <NotFound status={500} text={import.meta.env.DEV ? String(error) : 'This page could not be shown.'} />;
}
