# docs-kit

The shared core of a one-page documentation site on Vite, React Router (framework mode, built to static files), Fumadocs 16, MDX, Twoslash and Tailwind 4, with the table of contents on the left. It holds everything the maintainer's reviews of Reylo's site settled about how a docs page looks and behaves (Reylo's `wiki/docs-site.md` is the record), so that Reylo's site, Motherload's site and any later one share it instead of copying it. A site keeps only its content, its brand (name, mark, colours, fonts) and the pieces that are genuinely its own.

Its source is this repository: `~/Documents/docs-kit` on the maintainer's Mac, pushed to [colinhacks/docs-kit](https://github.com/colinhacks/docs-kit) (private, since 2026-10-20).

> [!IMPORTANT]
> A site holds a **copy** of this repository in `site/docs-kit/`. Never edit that copy: change this repository, then sync (below). The copy's `.synced.json` records the commit it came from and a hash of every file, and `node docs-kit/src/sync.mjs . --check` in the site fails when the copy was edited in place.

## What is in it

| Part | File | What it does |
| --- | --- | --- |
| Stylesheet | `src/style.css` | Fumadocs' neutral theme and preset, Twoslash's CSS, and every rule of the docs pages: the reading measure (one 40rem column that prose, headings, code, tab groups and tables share), the type scale, ruled h1 and h2 and a fainter hairline under each h3, the heading icons, links with an accent underline, inline code as a grey chip (headings included), the table of contents' entries and code chips and its fade, code that never scrolls sideways with a hanging indent, empty code lines that keep their height, WCAG AA colours for Shiki's GitHub tokens, Twoslash's popups and pinned `^?` cards, a `^|` query's completions as an editor's suggestion list, code tabs with the file name in the strip, variant tabs, two-column tables in halves, a table of labels and values without its empty header row, and phone tables, the quiet `<Details>`, the agent card, the rules that keep the layout still (the table of contents' column from the first paint, hidden inactive panels, a Copy button that keeps its width), and the cursors: a pointer on everything clickable, and one steady text cursor over a code block, its tab strip and its popups |
| Page shell | `src/components/shell.tsx` | `DocsShell`: Fumadocs' docs grid with the table of contents moved to the left, no top bar, the brand at the top of the left column and the GitHub link, the "Leave a star!" note and the theme switch at its foot (`TopRow` above the title below xl); `titleAside` puts an element at the right end of the title's row, above its rule; `footer` ends the column with a hairline and one quiet line, the licence and the copyright; `fold` leaves the h3s of chosen sections out of the table of contents so it fits one screen |
| Chrome | `src/components/chrome.tsx` | `TocHeader`, `TocFooter`, `TopRow`, given the site's brand element and repository URL |
| Document | `src/components/document.tsx`, `src/components/head-scripts.ts` | `DocsDocument`, for the site's `app/root.tsx`: `<html>`, the charset and viewport, the route's meta and links, Fumadocs' provider for React Router with search off, and three head scripts: `tabsRestoreScript` puts a saved tab choice in a stale spelling right before the tabs read it, `TABS_PREPAINT_SCRIPT` shows every saved tab choice from the first paint, and `KEEP_IN_PLACE_SCRIPT` keeps a pressed tab (or a `[data-keep-in-place]` toggle) under the pointer when the content above it changes height |
| Saved tabs from the first paint | `src/components/prepaint.tsx` | A tab group with a `groupId` server-renders every panel and is marked for the head script until it hydrates, so a reader whose saved choice is not the default sees no switch (on Reylo's page, with MySQL saved, 20 of 20 reloads near a group had shifted, up to 0.507) |
| Headings | `src/components/heading.tsx` | The link icon in the left margin, centred on the heading's lowercase letters, and the copy-as-Markdown button at the right end of the line |
| Collapsible | `src/components/details.tsx` | `<Details summary="…">`: a native `<details>` drawn as a quiet line with a chevron, its body a size smaller behind a thin rule |
| Code tabs | `src/components/code-tabs.tsx` | Fumadocs' code-tab group, with a file name every tab shares moved to the right end of the strip |
| Variant tabs | `src/components/variant-tabs.tsx` | `<VariantTabs group values [follow]>` and `<Variant value>`: one choice for the page (a dialect, a package manager), shared with code tabs of the same `tab-group`, remembered across visits and shown from the first paint |
| Agent card | `src/components/agent-prompt.tsx` | `<AgentPrompt title>`: a card with a title and a note over an ordinary code block of instructions for a coding agent, copied with the code block's own copy icon, which shows six lines and scrolls |
| Copy agent prompt | `src/components/copy-agent-prompt.tsx` | `<CopyAgentPrompt />`, given to `DocsShell` as `titleAside`: an outlined "Copy agent prompt" button at the right end of the title's row, which copies what the page's agent card copies (found by its `data-agent-prompt`, so the prompt is written once) and renders nothing on a page without a card |
| MDX components | `src/components/mdx.tsx` | `docsMdxComponents(own)`: Fumadocs' defaults, the headings, accordions, tabs, `<Details>`, code tabs and Twoslash's popups opening after 60ms; a site spreads its own over them |
| MDX options | `src/mdx/options.ts` | `docsMdxOptions(environment, options)`: Fumadocs' preset with `remarkSections` first, the site's remark plugins, Twoslash, the hanging indent and `recmaSharedPopups` |
| Twoslash | `src/mdx/twoslash.ts` | `docsTwoslash`: a cache on disk keyed by everything a result depends on (without it `next dev` grew by gigabytes per edit), the `// @hover: <names>` directive that keeps only the named popups, documentation over 400 characters left out, a site's own rewrite of a hover's text, and `mountPackage`, which mounts a package into every block from its source |
| Sections as Markdown | `src/mdx/remark-sections.ts` | Each h2's and h3's section as Markdown for its copy button: Twoslash setup, directives and queries removed, tabs and files labelled, every component's tags turned into bold labels or dropped |
| Shared popups | `src/mdx/recma-shared-popups.ts` | Each distinct Twoslash popup built once and referenced at each place it appears (Reylo's page went from 4.66 MB to 3.25 MB) |
| Hanging indent | `src/mdx/hanging-indent.ts` | A Shiki transformer that writes each line's indent as `--indent` |
| Vite plugins | `src/vite.ts` | `docsKit(mdxConfig)`: fumadocs-mdx over the site's `source.config.ts`, Tailwind 4, React Router, TypeScript and Twoslash kept out of the server bundle, and three for `vite dev` on a large page: the compiled page made small (Vite gave the server's copy of Reylo's page a 74 MB inline source map, and the server reached 4.4–5.0 GB), one compile per edit shared by the browser's and the server's copy, and each MDX file its own Fast Refresh boundary, so a section edit re-renders that section in under a second, with React Router's refresh handler registered at once so that no update is dropped |
| Sync | `src/sync.mjs` | Copies this repository into a site, and checks a site's copy |

## The boundary

A site keeps:

- its content (`content/docs/index.mdx`);
- its brand: a `Brand` element (mark and name, a link to `/`), its repository URL, its fonts (its own `@font-face` rules and files, preloaded from `app/root.tsx`, named to the stylesheet as `--font-text`, `--font-code` and `--font-hand`), and its colours (Fumadocs' `--color-fd-*` for `:root` and `.dark`, and `--dk-accent`, plus the washes below if its palette wants them different);
- its genuinely product-specific pieces: a remark plugin that types its examples (Reylo's SQL capture, Motherload's mapper), Twoslash's options (the package mounted from its source, compiler options, a rewrite of hover text), Shiki colour replacements, its variant groups (Reylo's dialects), figures, and the h2s whose h3s it folds out of the table of contents.

Everything about how a docs page looks and behaves is here. A rule the maintainer gives for one site's design, chrome, cursors or usability is a rule for all of them, so it lands here and every site gets it by syncing.

### Theme variables

| Variable | Default | Used for |
| --- | --- | --- |
| `--dk-accent` | Reylo's yellow | link underline, open Twoslash name, the selection |
| `--dk-code-tint` | `var(--color-fd-foreground)` | the colour inline code and the table of contents' code chips are a wash of |
| `--dk-code-size` | `13px` | code in the blocks and in Twoslash's popups, so a page that draws its code larger draws its popups' to match |
| `--color-fd-primary` | Fumadocs' | the accent where it carries text (active tabs, links on hover, the star note) |
| `--dk-wash-code` | `9%` | inline code |
| `--dk-wash-toc`, `--dk-wash-toc-hover`, `--dk-wash-toc-active` | `8%`, `11%`, `14%` | code chips in the table of contents |
| `--dk-wash-summary` | `7%` | code in a `<Details>` summary |
| `--dk-wash-selection` | `35%` | the text selection |
| `--dk-hover-rule` | `40%` | the dotted rule under a name with a Twoslash popup |
| `--dk-star` | `var(--color-fd-primary)` | the "Leave a star!" note |
| `--dk-popover-shadow` | a soft shadow, darker in `.dark` | Twoslash's popups |
| `--dk-prose-share`, `--dk-prose`, `--dk-quiet` | `90%`, the text's colour 90% toward the background, `var(--color-fd-muted-foreground)` | body text a step below the headings, and the quieter text of a collapsible's body |
| `--dk-column` | `40rem` | the one column of prose, headings, code, tab groups and tables |

Class names a page writes itself: `<p className="dk-subheader">` (the subheader under the title, which can hold inline code), `<div className="dk-features">` around a feature list (square bullets), `<p className="dk-lede">` (an italic, muted note).

## How a site consumes it

`site/docs-kit/` is a copy of this repository's `package.json`, `README.md` and `src/`, and the site depends on it as `"docs-kit": "link:./docs-kit"`, so it imports `docs-kit/…` exactly as it would import a published package.

```sh
node ~/Documents/docs-kit/src/sync.mjs ~/Documents/reylo/site      # copy, or update the copy
node ~/Documents/docs-kit/src/sync.mjs ~/Documents/reylo/site --check   # gate: fails on a copy edited in place
```

After a change here: commit it, sync every site, and run each site's gates. A running `vite dev` picks the new files up.

### Why a copy, and the alternatives rejected

Chosen by what a third site needs to adopt the core with the least code and the fewest moving parts, measured on 2026-10-20 with nub 0.9.6 and Next.js 16.3.2:

- **`link:` to this directory** (as Motherload links itself): refused by Turbopack. A symlinked package resolves to its real path, outside the site's `turbopack.root`, and Next fails with `Module not found: Can't resolve 'docs-kit/…'`. Moving `turbopack.root` up to `~/Documents` would make Turbopack's project the whole folder, and the package's imports (`fumadocs-ui`, `react`) would still resolve from this directory, not from the site, so each would need a `resolveAlias` back into the site's `node_modules`, or a second copy of React and Fumadocs would load and their contexts would not meet.
- **`file:` dependency** (an install that copies the directory into `node_modules`): resolves well, since nub's hoisted `.store/node_modules` gives the copy the site's React and Fumadocs, but nub freezes the copy at its first install. A later `nub install`, `--force`, a version bump, or deleting the copy from `node_modules/.store` all reinstalled the first snapshot from nub's global cache, so a change here would never reach a site.
- **A published package** (npm, or the GitHub repository as a git dependency), then a normal dependency: the cleanest end state, but outward-facing, and a git dependency on a private repository would need a token on every deploy; the repository is on GitHub (private) as the core's home, not as what the sites install. When it is published, a site swaps `link:./docs-kit` for a version and deletes its copy; nothing else changes, because the imports are already `docs-kit/…`. A package in `node_modules` then needs `transpilePackages: ['docs-kit']` (or a build to JavaScript) and `@source` for Tailwind, which `style.css` already declares.
- **A git submodule or subtree** in each site: the same copy with more machinery (detached heads, merge commits in a linear history) and no check that the copy was not edited.

Vite has the same two problems with a `link:`: its dev server serves no file outside the site's root unless told to, and the package's imports would resolve from this directory, not the site, so a second React and Fumadocs would load. The copy keeps every repository self-contained (a site still builds from its own checkout, and a deploy that uploads the repository works), sits inside Turbopack's root (hot reload works, the site's own React and Fumadocs resolve), and is type-checked by each site's `next build` under the site's tsconfig.

## How a third site adopts it

A Fumadocs site on Vite and React Router (`fumadocs-ui`, `fumadocs-core`, `fumadocs-mdx`, `fumadocs-twoslash`, `@shikijs/twoslash`, `react-router`, `@react-router/dev`, `@react-router/node`, `vite`, `@tailwindcss/vite`, Tailwind 4) needs, after `node ~/Documents/docs-kit/src/sync.mjs <site>`, `"docs-kit": "link:./docs-kit"` in its dependencies (then `nub install`), `"allowImportingTsExtensions": true` in its tsconfig (the build-time modules name their `.ts` extensions, since fumadocs-mdx imports them in Node itself), its paths mapping `collections/*` to `./.source/*` (fumadocs-mdx's generated collections), and these files:

```ts title="vite.config.ts"
import path from 'node:path';
import { docsKit } from 'docs-kit/vite';
import { defineConfig } from 'vite';
import * as mdxConfig from './source.config.ts';

export default defineConfig({
  plugins: docsKit(mdxConfig),
  resolve: { alias: { '@': import.meta.dirname, collections: path.join(import.meta.dirname, '.source') } },
});
```

```ts title="react-router.config.ts"
import type { Config } from '@react-router/dev/config';

// Static files only (build/client): every path is rendered at build time.
export default { ssr: false, prerender: ['/'] } satisfies Config;
```

```ts title="source.config.ts"
import { defineConfig, defineDocs } from 'fumadocs-mdx/config';

// Imported inside the options, so only the build loads them (and TypeScript with them).
const mdxOptions = async (environment: 'bundler' | 'runtime') => (await import('docs-kit/mdx')).docsMdxOptions(environment, { twoslash: {} });

export const docs = defineDocs({ dir: 'content/docs', docs: { mdxOptions } });
export default defineConfig();
```

```ts title="app/routes.ts"
import { index, type RouteConfig } from '@react-router/dev/routes';

export default [index('routes/home.tsx')] satisfies RouteConfig;
```

```tsx title="app/root.tsx"
import './global.css';
import { DocsDocument } from 'docs-kit/document';
import { Outlet } from 'react-router';
import fontsCss from './fonts.css?url'; // the site's own @font-face rules

export const links = () => [{ rel: 'stylesheet', href: fontsCss }];

export function Layout({ children }: { children: React.ReactNode }) {
  return <DocsDocument>{children}</DocsDocument>;
}

export default function App() {
  return <Outlet />;
}
```

```tsx title="app/routes/home.tsx"
import { DocsShell } from 'docs-kit/shell';
import { docsMdxComponents } from 'docs-kit/components';
import { docs } from 'collections/server';
import { loader } from 'fumadocs-core/source';

const source = loader({ baseUrl: '/', source: docs.toFumadocsSource() });
const brand = <a href="/" className="text-lg font-semibold text-fd-headings">Acme</a>;

export const meta = () => [{ title: 'Acme' }];

export default function Home() {
  const page = source.getPage([])!;
  const MDX = page.data.body;
  return (
    <DocsShell tree={source.getPageTree()} title={page.data.title} toc={page.data.toc} brand={brand} github="https://github.com/acme/acme">
      <MDX components={docsMdxComponents()} />
    </DocsShell>
  );
}
```

```css title="app/global.css"
@import 'docs-kit/style.css';

:root {
  --font-text: 'Geist', 'Geist Fallback';
  --font-code: 'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace;
  --font-hand: 'Caveat', 'Caveat Fallback';
  --dk-accent: hsl(150 60% 45%);
  /* Fumadocs' --color-fd-* for the light theme */
}

.dark {
  --dk-accent: hsl(150 60% 55%);
  /* … for the dark theme */
}
```

Give its text and code fonts `font-display: optional` and preload their Latin files from `app/root.tsx`'s `links` (a font that arrives after the first paint rewraps the text, a layout shift), and let the code font fall back to the system's monospace. Link the `@font-face` rules from `links` as a stylesheet of their own, never `@import` them from `global.css`: under `vite dev`, React Router serves imported CSS as a stylesheet it removes once the page hydrates, when Vite injects its own copy, and faces declared again then miss `optional`'s window, so the page drops to its fallback fonts for the rest of the visit (Motherload's page went from IBM Plex to Arial, 2026-10-21). `react-router build` then writes the site to `build/client`, which any static host serves as it is (a `vercel.json` of `{ "framework": null, "outputDirectory": "build/client" }` on Vercel).

A long page splits into one MDX file per h2, so that an edit compiles one section: a second collection (`defineCollections({ type: 'doc', dir: 'content/sections', mdxOptions })`), rendered after the page's own MDX in the order of the files' names, with the table of contents theirs in order (`[...page.data.toc, ...sections.flatMap((s) => s.toc)]`).

Reylo's `site/` is the full example: a page split into sections, its own remark plugin and Twoslash options (`lib/mdx-options.ts`), its own components (`components/mdx.tsx`), and the files beside the page (`/llms.txt`, robots, sitemap, manifest, the link preview) rendered at build time by resource routes.
