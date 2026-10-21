// The link preview motherload.dev shows on X, Slack, Discord, LinkedIn and the rest, written to
// build/client/opengraph-image.png at build time: the page links it as og:image, and as X's image
// too, with a hash of this file's text in its URL (lib/og.ts). The card is drawn here rather than in
// a module this file imports, so that a change to the card changes the URL and the caches of X and
// Slack fetch the new card.
//
// The wordmark and the address over the headline, stacked on the left, beside the hero's main.ts
// with every import, as the page's code tabs show it: the maintainer's pick on 2026-10-20 of six
// candidates ("I like the headline beside the hero, option F"), over Reylo's layout with one import
// and its typed popup, the formats as chips, a YAML file beside its type, and the bars alone. Drawn
// by @vercel/og's ImageResponse (Satori) in the dark Lantern theme of app/global.css: IBM Plex Sans and
// IBM Plex Mono (assets/fonts, SIL Open Font License, from IBM's releases) on the coal page with
// its amber glow, the code in the page's colours (lib/mdx-options.ts). Satori lays out flex boxes
// only, so every element with more than one child is a flex box. X lays the domain over the card's
// bottom-left corner, about 380 × 90 of it on a phone, which the layout leaves empty.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CSSProperties, ReactNode } from 'react';
import { ogSize } from '@/lib/og';

// The dark theme of app/global.css, with its glow, and the dark code colours of lib/mdx-options.ts.
const color = {
  page: '#0D0E10',
  glow: 'radial-gradient(1100px 700px at 6% -14%, rgba(245, 165, 36, 0.15), rgba(245, 165, 36, 0) 70%)',
  surface: '#14161A',
  border: '#2A2D33',
  headings: '#F6EEDF',
  muted: '#97958F',
  ore: '#F5A524',
  keyword: '#f5a524',
  plain: '#d0ccc4',
  string: '#f2d39a',
};

type Token = [text: string, ink: 'keyword' | 'plain' | 'string'];

const imp = (name: string, file: string): Token[] => [
  ['import', 'keyword'],
  [` ${name} `, 'plain'],
  ['from', 'keyword'],
  [` "./${file}"`, 'string'],
  [';', 'plain'],
];

// The hero's main.ts (content/docs/index.mdx).
const hero: Token[][] = [
  imp('plans', 'plans.toml'),
  imp('team', 'team.yaml'),
  imp('strings', 'strings.json5'),
  imp('posts', 'posts.csv'),
  imp('notes', 'notes.md'),
  [['import', 'keyword'], [' "./.env"', 'string'], [';', 'plain']],
];

const MONO = 'IBM Plex Mono';
const SANS = 'IBM Plex Sans';

// Sizes, in pixels of the 1200 × 630 image.
const PAD = 64;
const CODE = 26;
const HEADLINE = 62;
const WORDMARK = 38;

/** app/icon.svg. */
function Bars({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <g stroke="#4a230d" strokeWidth="1.3" strokeLinejoin="round">
        <path d="M1.5 27.5H15.5L13.3 18.5H3.7Z" fill="#e4a636" />
        <path d="M16.5 27.5H30.5L28.3 18.5H18.7Z" fill="#e4a636" />
        <path d="M9 16.8H23L20.8 7.8H11.2Z" fill="#f2b93e" />
      </g>
      <g fill="#ffe696">
        <path d="M4.4 19.3H12.6L13 21H4Z" />
        <path d="M19.4 19.3H27.6L28 21H19Z" />
        <path d="M11.9 8.6H20.1L20.5 10.3H11.5Z" />
      </g>
    </svg>
  );
}

/** The site's wordmark (components/brand.tsx): the bars, raised a little, beside the name, and the status. */
function Wordmark() {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <div style={{ display: 'flex', marginTop: -WORDMARK * 0.1 }}>
        <Bars size={Math.round(WORDMARK * 1.16)} />
      </div>
      <div style={{ display: 'flex', marginLeft: WORDMARK * 0.32, fontFamily: SANS, fontWeight: 600, fontSize: WORDMARK, letterSpacing: -WORDMARK * 0.015, color: color.headings }}>
        Motherload
      </div>
      <div
        style={{
          display: 'flex',
          marginLeft: WORDMARK * 0.42,
          padding: `${WORDMARK * 0.1}px ${WORDMARK * 0.3}px ${WORDMARK * 0.12}px`,
          border: `1.5px solid ${color.border}`,
          borderRadius: 999,
          fontFamily: MONO,
          fontSize: WORDMARK * 0.5,
          color: color.muted,
        }}
      >
        beta
      </div>
    </div>
  );
}

function Code({ lines }: { lines: Token[][] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', fontFamily: MONO, fontSize: CODE, lineHeight: 1.55 }}>
      {lines.map((line, i) => (
        <div key={i} style={{ display: 'flex', whiteSpace: 'pre', height: CODE * 1.55 }}>
          {line.map(([text, ink], j) => (
            <span key={j} style={{ color: color[ink] }}>
              {text}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

/** A code panel under a strip of file tabs, the first one open, as the page's code tabs draw it. */
function Window({ tabs, children, style }: { tabs: string[]; children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: color.surface, border: `1.5px solid ${color.border}`, borderRadius: 16, ...style }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', padding: '0 14px', borderBottom: `1.5px solid ${color.border}`, height: 54 }}>
        {tabs.map((tab, i) => (
          <div
            key={tab}
            style={{
              display: 'flex',
              padding: '0 12px 13px',
              marginBottom: -1.5,
              fontFamily: MONO,
              fontWeight: 500,
              fontSize: 20,
              color: i === 0 ? color.headings : color.muted,
              borderBottom: `3px solid ${i === 0 ? color.ore : 'transparent'}`,
            }}
          >
            {tab}
          </div>
        ))}
      </div>
      {children}
    </div>
  );
}

function Card(): ReactNode {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: `56px ${PAD}px`, background: color.page, backgroundImage: color.glow, fontFamily: SANS }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Wordmark />
        <div style={{ display: 'flex', fontFamily: MONO, fontSize: 24, color: color.muted }}>motherload.dev</div>
      </div>
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', fontSize: HEADLINE, fontWeight: 600, letterSpacing: -HEADLINE * 0.022, lineHeight: 1.13, color: color.headings }}>
          {['Import data', 'files into', 'TypeScript,', 'fully typed'].map((line) => (
            <div key={line} style={{ display: 'flex', whiteSpace: 'pre' }}>
              {line}
            </div>
          ))}
        </div>
        <Window tabs={['main.ts', 'plans.toml', 'team.yaml', 'strings.json5']} style={{ width: 680, marginTop: 8 }}>
          <div style={{ display: 'flex', padding: '18px 26px 22px' }}>
            <Code lines={hero} />
          </div>
        </Window>
      </div>
    </div>
  );
}

const font = async (file: string, name: string, weight: 400 | 500 | 600) => ({
  name,
  weight,
  style: 'normal' as const,
  data: await readFile(join(process.cwd(), 'assets/fonts', file)),
});

/**
 * The preview as a PNG, built once, with the site. @vercel/og is 0.11.1, the version Next.js 16.3
 * bundled (1.0.3 fails under Node 26 with "Dynamic require of fs is not supported"), loaded here so
 * that only the build loads it.
 */
export async function loader() {
  const { ImageResponse } = await import('@vercel/og');
  const fonts = await Promise.all([
    font('IBMPlexSans-SemiBold.ttf', SANS, 600),
    font('IBMPlexMono-Regular.ttf', MONO, 400),
    font('IBMPlexMono-Medium.ttf', MONO, 500),
  ]);
  return new ImageResponse(<Card />, { ...ogSize, fonts });
}
