# docs-kit

The shared core of a one-page documentation site on Vite, React Router (framework mode, built to static files), Fumadocs 16, MDX, Twoslash and Tailwind 4, with the table of contents on the left. It holds everything the maintainer's reviews of Reylo's site settled about how a docs page looks and behaves (Reylo's `wiki/docs-site.md` is the record), so that Reylo's site, Motherload's site and any later one share it instead of copying it. A site keeps only its content, its brand (name, mark, colours, fonts) and the pieces that are genuinely its own.

Its source is this repository: `~/Documents/docs-kit` on the maintainer's Mac, pushed to [colinhacks/docs-kit](https://github.com/colinhacks/docs-kit) (private, since 2026-10-20).

> [!IMPORTANT]
> A site holds a **copy** of this repository in `site/docs-kit/`. Never edit that copy: change this repository, then sync (below). The copy's `.synced.json` records the commit it came from and a hash of every file, and `node docs-kit/src/sync.mjs . --check` in the site fails when the copy was edited in place.

## What is in it

| Part | File | What it does |
| --- | --- | --- |
| Stylesheet | `src/style.css` | Fumadocs' neutral theme and preset, Twoslash's CSS, and every rule of the docs pages: the reading measure (one 40rem column that prose, headings, code, tab groups and tables share), the type scale, ruled h1 and h2 and a fainter hairline under each h3, the heading icons (the link icon shown on hover), links with an accent underline, inline code as a grey chip (headings included), the table of contents' entries and code chips and its fade, code that never scrolls sideways with a hanging indent, empty code lines that keep their height, WCAG AA colours for Shiki's GitHub tokens, Twoslash's popups and pinned `^?` cards, an error's red squiggle and its pinned card, a `^|` query's completions as an editor's suggestion list, code tabs with the file name in the strip, variant tabs, two-column tables in halves, a table of labels and values without its empty header row, and phone tables, the quiet `<Details>`, the agent card, the rules that keep the layout still (the table of contents' column from the first paint, hidden inactive panels and closed accordion items, a Copy button that keeps its width), and the cursors: a pointer on everything clickable, and one steady text cursor over a code block, its tab strip and its popups |
| Page shell | `src/components/shell.tsx` | `DocsShell`: Fumadocs' docs grid with the table of contents moved to the left, no top bar, the brand at the top of the left column and the GitHub link, the "Leave a star!" note and the theme switch at its foot (`TopRow` above the title below xl); `pages` lists a site's pages in the left column, in labelled groups, with a page's own `items` a level in under it; `titleAside` puts an element at the right end of the title's row, above its rule; `footer` ends the column with a hairline and one quiet line, the licence and the copyright; `fold` leaves the h3s of chosen sections out of the table of contents so it fits one screen |
| Chrome | `src/components/chrome.tsx` | `TocHeader`, `TocFooter`, `TopRow`, given the site's brand element and repository URL |
| Document | `src/components/document.tsx`, `src/components/head-scripts.ts` | `DocsDocument`, for the site's `app/root.tsx`: `<html>`, the charset and viewport, the route's meta and links, Fumadocs' provider for React Router, with search off unless the site names its index (`search`, below), and three head scripts: `tabsRestoreScript` puts a saved tab choice in a stale spelling right before the tabs read it, `TABS_PREPAINT_SCRIPT` shows every saved tab choice from the first paint, and `KEEP_IN_PLACE_SCRIPT` keeps a pressed tab (or a `[data-keep-in-place]` toggle) under the pointer when the content above it changes height |
| Site config | `src/site.ts` (`docs-kit/site`) | `defineSite`, for the site's `docs.config.ts` ([A site's config and routes](#a-sites-config-and-routes)): what differs between sites, from the name and address to the footer; `siteMeta`, a page's title, description, canonical and Markdown links, and Open Graph and X tags; `structuredData`, the first page's schema.org data |
| Page route | `src/page.tsx` (`docs-kit/page`), `src/page.server.ts` (`docs-kit/page.server`) | `<DocsPage>` and `pageMeta`, for the site's `app/routes/page.tsx`, with `pageLoader` as its loader: the page in the shell with its sections after it, its meta tags, its link preview and the address of its Markdown |
| Routes | `src/routes.ts` (`docs-kit/routes`), `src/routes/` | `docsRoutes`, for the site's `app/routes.ts`: the pages, `/404`, `/llms.txt`, `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest` and each page's `.md`; `docsPrerender`, their paths for `react-router.config.ts` |
| Not found | `src/components/not-found.tsx` | `NotFound`, the page for a missing address, and `DocsErrorBoundary`, the site root's error boundary |
| Page files | `src/mdx/page-files.ts` (`docs-kit/mdx`) | `pageSlugs`, `pageFiles` and `sitePages`: a site's pages and each page's MDX files, read from its folder in plain Node, for its remark plugins and scripts |
| Saved tabs from the first paint | `src/components/prepaint.tsx` | A tab group with a `groupId` server-renders every panel and is marked for the head script until it hydrates, so a reader whose saved choice is not the default sees no switch (on Reylo's page, with MySQL saved, 20 of 20 reloads near a group had shifted, up to 0.507) |
| Headings | `src/components/heading.tsx` | The link icon in the left margin, centred on the heading's lowercase letters, hidden until the heading is hovered or the icon has keyboard focus and always shown on a device without hover, and the copy-as-Markdown button at the right end of the line |
| Accordions | `src/components/accordion.tsx` | `<Accordions>` and `<Accordion title id>`, in place of Fumadocs' (the same props and look): a closed item's content is in the HTML, hidden by `hidden="until-found"` once the page hydrates, so find-in-page and a link to an `id` inside it open the item, and the opening and closing animation still plays |
| Collapsible | `src/components/details.tsx` | `<Details summary="…">`: a native `<details>` drawn as a quiet line with a chevron, its body a size smaller behind a thin rule |
| Copy buttons | `src/components/copy-icons.tsx`, `src/components/code-copy.tsx` | One copy icon and one check for every copy button: the heading's, the code block's (docs-kit's own, in place of Fumadocs' clipboard, with a "Copy code" tooltip) and "Copy agent prompt" |
| Code tabs | `src/components/code-tabs.tsx` | Fumadocs' code-tab group, with a file name every tab shares moved to the right end of the strip, and a child marked `aside` (a `<VariantSwitch aside>`) drawn at the strip's right end |
| Variant tabs | `src/components/variant-tabs.tsx` | `<VariantTabs group values [follow]>` and `<Variant value>`: one choice for the page (a dialect, a package manager), shared with code tabs of the same `tab-group`, remembered across visits and shown from the first paint; `<VariantSwitch group values>`, the same choice as a small segmented control with no panels, for the right end of a code-tab strip whose file tabs follow it |
| Callout | `src/components/callout.tsx` | `<Callout>` and `<Callout title>`, in place of Fumadocs' (the same props): a flat card whose header bar, ruled off like a titled code block's, holds an amber icon, a lightbulb for a note and a triangle for `type="warn"`, and the title or "Note" ("Warning"), over the text as an aside: 14px, a step dimmer than the body, its code 12px |
| Agent card | `src/components/agent-prompt.tsx` | `<AgentPrompt title>`: a card with a title and a note over an ordinary code block of instructions for a coding agent, copied with the code block's own copy icon, which shows six lines and scrolls |
| Copy agent prompt | `src/components/copy-agent-prompt.tsx` | `<CopyAgentPrompt />`, given to `DocsShell` as `titleAside`: an outlined "Copy agent prompt" button at the right end of the title's row, which copies what the page's agent card copies (found by its `data-agent-prompt`, so the prompt is written once) and renders nothing on a page without a card |
| MDX components | `src/components/mdx.tsx` | `docsMdxComponents(own)`: Fumadocs' defaults, the headings, the accordions, tabs with every panel rendered, `<Details>`, code tabs and Twoslash's popups opening after 60ms; a site spreads its own over them |
| MDX options | `src/mdx/options.ts` | `docsMdxOptions(environment, options)`: Fumadocs' preset with `remarkSections` first, the site's remark plugins, Twoslash, the errors of any block, the hanging indent and `recmaSharedPopups` |
| Twoslash | `src/mdx/twoslash.ts` | `docsTwoslash`: a cache on disk keyed by everything a result depends on (without it `next dev` grew by gigabytes per edit), the `// @hover: <names>` directive that keeps only the named popups, each `// @errors` error's message in the pinned error card (below) in place of Twoslash's line of red text, documentation over 400 characters left out, a site's own rewrite of a hover's text, and `mountPackage`, which mounts a package into every block from its source |
| Errors in code blocks | `src/mdx/diagnostics.ts` (`docs-kit/diagnostics`) | An error drawn as the editor draws it, in any language: a red squiggle under its exact range and its message and source (`reylo(6)`, `ts(2339)`) in the `^?` card, pinned under the range's last line in space it opens there, never over the code; on a phone the card takes the block's width. A block carries its errors as `// @diagnostic: <line>:<column>-<line>:<column> <source> <message>` lines (from 1, as an editor counts; the end is after the range's last character), which come out before it is highlighted, so a site's remark plugin writes them (`diagnosticDirective`) from errors its tool really gave (Reylo's site, those its content mapper gives each `.sql` error example) |
| Sections as Markdown | `src/mdx/remark-sections.ts` | Each h2's and h3's section as Markdown for its copy button: Twoslash setup, directives and queries removed, tabs and files labelled, every component's tags turned into bold labels or dropped; and `pageMarkdown(sources, { site, page })`, a whole page so, under its title and description with its links made absolute, for `/llms.txt` and for an agent that asks for Markdown (below) |
| Shared popups | `src/mdx/recma-shared-popups.ts` | Each distinct Twoslash popup built once and referenced at each place it appears (Reylo's page went from 4.66 MB to 3.25 MB) |
| Hanging indent | `src/mdx/hanging-indent.ts` | A Shiki transformer that writes each line's indent as `--indent` |
| Vite plugins | `src/vite.ts` | `docsKit(mdxConfig)`: fumadocs-mdx over the site's `source.config.ts`, Tailwind 4, React Router, TypeScript and Twoslash kept out of the server bundle, and three for `vite dev` on a large page: the compiled page made small (Vite gave the server's copy of Reylo's page a 74 MB inline source map, and the server reached 4.4–5.0 GB), one compile per edit shared by the browser's and the server's copy, and each MDX file its own Fast Refresh boundary, so a section edit re-renders that section in under a second, with React Router's refresh handler registered at once so that no update is dropped |
| Search | `src/search/index.ts` (`docs-kit/search`), `src/search/engine.ts`, `src/components/search.tsx`, `src/components/search-trigger.tsx` | For a site of several pages ([Search](#search)): `searchIndex(pages)` builds the index at build time; the dialog and the search it runs in the browser; the field under the name in the left column, the icon in the top row and the field over the list of pages on a phone, and the `/` key |
| Build checks | `src/check-links.mjs`, `src/check-headings.mjs`, `src/check-routes.mjs` | Run on the built site, each failing the build: a link to a page or heading the build lacks; a lone subsection, or a page with no sentence before its first h2; an address the site once served that it no longer answers, held in a lockfile (`routes.lock`) that every new page and redirect is added to, which only a redirect to the page that took its place satisfies |
| Sync | `src/sync.mjs` | Copies this repository into a site, and checks a site's copy |

## The boundary

A site keeps:

- its content (`content/docs/index.mdx`);
- its config, `docs.config.ts`: its name, address, repository, titles and footer;
- its brand: a `Brand` element (mark and name, a link to `/`), its fonts (its own `@font-face` rules and files, preloaded from `app/root.tsx`, named to the stylesheet as `--font-text`, `--font-code` and `--font-hand`), and its colours (Fumadocs' `--color-fd-*` for `:root` and `.dark`, and `--dk-accent`, plus the washes below if its palette wants them different);
- its genuinely product-specific pieces: a remark plugin that types its examples (Reylo's SQL capture, Motherload's mapper), Twoslash's options (the package mounted from its source, compiler options, a rewrite of hover text), its Shiki themes or colour replacements, its variant groups (Reylo's dialects), figures, and the h2s whose h3s it folds out of the table of contents.

Everything about how a docs page looks and behaves is here. Nothing folded away is left out of the HTML: a closed accordion's content, every tab's panel and a closed `<Details>`' body are all in the prerendered page, hidden until opened, so a coding agent that fetches the page, a search engine and find-in-page read all of it (the maintainer, 2026-10-21: "We definitely should be servicing the HTML for closed accordions. That's a huge problem"). A rule the maintainer gives for one site's design, chrome, cursors or usability is a rule for all of them, so it lands here and every site gets it by syncing.

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

## A site's config and routes

A site describes itself in one file and mounts Docs Kit's routes beside its own. Its page route is a few lines.

### The config

The site's root holds `docs.config.ts`, which Docs Kit imports as `@/docs.config`:

```ts title="docs.config.ts"
import { defineSite } from 'docs-kit/site';

export default defineSite({
  name: 'Motherload',
  url: 'https://motherload.dev', // with the path the docs are served under: https://pullfrog.com/docs
  repo: 'https://github.com/colinhacks/motherload',
  title: 'Motherload — Import data files into TypeScript, fully typed', // the first page's <title>
});
```

Every other field is optional:

```ts title="docs.config.ts"
export default defineSite({
  // ...
  pageTitle: (title) => `${title} | Acme`, // every other page's <title>; `<title> — <name>` by default
  pages: ['', 'install', 'config'], // reading order for llms.txt and the sitemap; content/docs by name by default
  description: 'Import data files into TypeScript as typed modules.', // the manifest's
  author: { name: 'Colin McDonnell', url: 'https://github.com/colinhacks' },
  x: { creator: '@colinhacks', site: '@pullfrogai' },
  footer: 'Released under the MIT License. Copyright © 2026 Colin McDonnell.',
  color: '#0D0E10', // the manifest's background and theme
  ogAlt: 'Motherload: import data files into TypeScript, fully typed.', // the link preview's alt text, with its type and size
  // the first page's schema.org data, for a library
  software: { language: 'TypeScript', platform: 'Node.js', license: 'https://opensource.org/licenses/MIT' },
});
```

### The page route

The site's `app/routes/page.tsx` renders `<DocsPage>` with its brand and MDX components:

```tsx title="app/routes/page.tsx"
import { DocsPage, pageMeta } from 'docs-kit/page';
import { pageLoader } from 'docs-kit/page.server';
import type { Route } from './+types/page';
import { Brand } from '@/components/brand';
import { getMDXComponents } from '@/components/mdx';

export async function loader(args: Route.LoaderArgs) {
  return pageLoader(args);
}

export function meta(args: Route.MetaArgs): Route.MetaDescriptors {
  return pageMeta(args);
}

export default function Page({ loaderData }: Route.ComponentProps) {
  return <DocsPage data={loaderData} brand={<Brand />} components={getMDXComponents()} />;
}
```

Any other prop goes to `DocsShell`, such as `fold` or `titleAside`. A page's link preview is the first of these that exists:

- `public/og/<slug>.png`
- `public/og/index.png`
- `app/routes/opengraph-image.tsx`, at `/opengraph-image.png?<hash of the file>`

### The routes

The site's `app/routes.ts` spreads Docs Kit's routes beside its own:

```ts title="app/routes.ts"
import { route, type RouteConfig } from '@react-router/dev/routes';
import { docsRoutes } from 'docs-kit/routes';

export default [...docsRoutes(), route('opengraph-image.png', 'routes/opengraph-image.tsx')] satisfies RouteConfig;
```

Its `react-router.config.ts` renders the same paths to files:

```ts title="react-router.config.ts"
import type { Config } from '@react-router/dev/config';
import { docsPrerender } from 'docs-kit/routes';

export default { ssr: false, prerender: [...docsPrerender(), '/opengraph-image.png'] } satisfies Config;
```

Each route has an option:

| Address | Option | Serves |
| --- | --- | --- |
| `/`, `/<slug>` | `page` | the site's `routes/page.tsx` |
| `/<slug>.md`, `/index.md` | `markdown` | each page as Markdown, on a site of several pages |
| `/llms.txt` | `llms` | every page as Markdown, in reading order |
| `/404` | `notFound` | the page for a missing address |
| `/robots.txt` | `robots` | every page open to crawlers, and the sitemap |
| `/sitemap.xml` | `sitemap` | every page's address |
| `/manifest.webmanifest` | `manifest` | the name, description and colour, with `public/icon-192.png` and `public/icon-512.png` |

An option names the site's own file in place of Docs Kit's, or leaves the route out with `false`:

```ts
docsRoutes({ llms: 'routes/llms.ts', manifest: false });
docsPrerender({ llms: 'routes/llms.ts', manifest: false }); // the same options, so the paths match
```

The root's error boundary is Docs Kit's too:

```tsx title="app/root.tsx"
import { DocsErrorBoundary } from 'docs-kit/components';

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <DocsErrorBoundary error={error} />;
}
```

### The site's own routes

A route of the site's own builds its meta tags and Markdown from the same pieces:

```ts
import { markdownOf, ogImage, source } from 'docs-kit/page.server'; // build time only: in a loader
import { siteMeta } from 'docs-kit/site';
import { pageFiles, pageSlugs, sitePages } from 'docs-kit/mdx'; // plain node: remark plugins, scripts

source.getPage(['postgres']); // fumadocs' source over content/docs
await markdownOf('postgres', expandErrors); // a page as markdown, each file rewritten first
await ogImage('postgres'); // a page's link preview
siteMeta(site, { title: 'Showcase', description, url, markdown, image, index: false }); // kept out of search
pageSlugs(); // ['', 'mysql', 'postgres']
pageFiles(); // content/docs/index.mdx, then content/sections/*.mdx
sitePages(); // each page's files, the first page first
```

## Markdown for agents

A coding agent that fetches a page and asks for Markdown gets the page as Markdown, from the page's own address (the maintainer, 2026-10-21: "we should be actually returning Markdown or MDX or whatever if an agent accesses the page ... We should be doing that in both Reylo and Motherload, and DocsKit in general"). This is HTTP content negotiation: the request's `Accept` header names `text/markdown`, and the answer is `Content-Type: text/markdown; charset=utf-8`, with `Vary: Accept` on both the Markdown and the HTML so that a cache keeps them apart, as Cloudflare's Markdown for Agents answers.

What agents send, as measured by others (Checkly fetched httpbin.org/headers with each agent's own fetch tool in February 2026, https://www.checklyhq.com/blog/state-of-ai-agent-content-negotation/; acceptmarkdown.com keeps a table, https://acceptmarkdown.com/status):

| Agent | `Accept` |
| --- | --- |
| Claude Code (WebFetch) | `text/markdown, text/html, */*` |
| Cursor | `text/markdown,text/html;q=0.9,application/xhtml+xml;q=0.8,…` |
| OpenCode | `text/markdown;q=1.0, text/x-markdown;q=0.9, text/plain;q=0.8, text/html;q=0.7, */*;q=0.1` |
| GitHub Copilot Chat and CLI | `text/markdown, text/html;q=0.9, …` (acceptmarkdown.com, 2026-06-22) |
| OpenAI Codex | a browser's `text/html,application/xhtml+xml,…`; it follows a page's `<link rel="alternate" type="text/markdown">` instead |
| Gemini CLI, Windsurf | `*/*` |

The rule: serve Markdown when the `Accept` header names `text/markdown` (or `text/x-markdown`) and does not name `text/html` before it. Every agent above that asks for Markdown lists it first; a browser never names it; `*/*` and `curl`'s default get HTML. As a regular expression on the header:

```
^(?!.*text/html.*text/(?:x-)?markdown).*text/(?:x-)?markdown.*$
```

Each page's head names its Markdown with `<link rel="alternate" type="text/markdown">` (`pageMeta`), for an agent that reads the HTML first, as Codex does.

**The Markdown.** Each page's is `pageMarkdown(sources, { site, page })` from `docs-kit/remark-sections`, rendered to a file at build time by Docs Kit's routes: the page's source files in order (the first holds the frontmatter), read as each heading's copy button reads its section. A one-page site serves its `/llms.txt` as the page's Markdown (Motherload); a site of several pages writes each page's to `/<page>.md`, and `/index.md` for `/`, and joins them for `/llms.txt`.

**The types the page shows.** Each Twoslash query (`//    ^?`) keeps its result in the Markdown, after its caret, as Twoslash writes a query in plain text; until 2026-10-21 the Markdown dropped the query line, so an agent that read it never saw the type the page shows, and a fresh agent setting Motherload up from its docs guessed a `.md` file's body was `body` (it is `md`). Twoslash runs in the compile, after the remark plugins, so `remarkQueryBlocks` names each `ts twoslash` block that has a query with a first line, `// @docs-block: <id>` (`blockId`: its file's text, its own and how many identical blocks come before it), the Twoslash transformer takes the line out and records each query's result, as its popup shows it, under the id in `node_modules/.cache/docs-kit/queries/<id>.json`, and `rehypeSections` writes each heading's section Markdown again with them. A resource route rendered at build time runs after every page has compiled, so `pageMarkdown` finds each result there; in the dev server a page compiles when it is opened, so its Markdown has its types once it has. A site that shows a block once per variant writes `// @variant: <name>` into each copy, which the transformer takes out too, and where the variants' results differ, each is written under the names that show it (Reylo's dialects: `^? Postgres: …`, then `MySQL: …`).

**On Vercel**, from static files. A `rewrites` entry cannot do it: Vercel serves a file that exists at the path before it applies a rewrite, and every page is a file. A `routes` entry runs before the filesystem, may sit beside `redirects` and `headers`, and takes a `has` condition on a request header. A route that matches skips the `headers` block, so it sets its own; the `headers` block gives the HTML its `Vary`:

```json title="vercel.json"
{
  "framework": null,
  "outputDirectory": "build/client",
  "routes": [
    {
      "src": "^/$",
      "has": [{ "type": "header", "key": "accept", "value": "^(?!.*text/html.*text/(?:x-)?markdown).*text/(?:x-)?markdown.*$" }],
      "dest": "/index.md",
      "headers": { "Content-Type": "text/markdown; charset=utf-8", "Vary": "Accept" }
    },
    {
      "src": "^/(postgres|mysql|sqlite)$",
      "has": [{ "type": "header", "key": "accept", "value": "^(?!.*text/html.*text/(?:x-)?markdown).*text/(?:x-)?markdown.*$" }],
      "dest": "/$1.md",
      "headers": { "Content-Type": "text/markdown; charset=utf-8", "Vary": "Accept" }
    }
  ],
  "headers": [
    { "source": "/:page(|postgres|mysql|sqlite)", "headers": [{ "key": "Vary", "value": "Accept" }] },
    { "source": "/(llms\\.txt|.*\\.md)", "headers": [{ "key": "Content-Type", "value": "text/markdown; charset=utf-8" }] }
  ]
}
```

That is Reylo's; Motherload's one route sends `/` to `/llms.txt`. A new page joins both lists. Vercel's `has` works only once deployed (`vercel dev` ignores it), so check production after the deploy:

```sh
curl -sI -H 'Accept: text/markdown' https://reylo.dev/postgres   # content-type: text/markdown; charset=utf-8, vary: Accept
curl -sI https://reylo.dev/postgres                               # content-type: text/html; charset=utf-8, vary: Accept
```

## Search

A site of several pages gets search by building an index and naming it to `DocsDocument`. The index is one JSON file written at build time and the search runs in the browser, so there is no server and no dependency.

```ts title="app/routes/search.ts"
import { readFile } from 'node:fs/promises';
import { searchIndex } from 'docs-kit/search';
import { source } from 'docs-kit/page.server';

export async function loader() {
  const pages = await Promise.all(
    // equal results keep this order, so list the pages as a reader takes them
    source.getPages().map(async (page) => ({
      url: page.url,
      title: page.data.title ?? '',
      description: page.data.description,
      // a page split into sections passes its files in order
      source: await readFile(`content/docs/${page.path}`, 'utf8'),
      toc: page.data.toc,
    })),
  );
  return Response.json(searchIndex(pages));
}
```

```ts title="app/routes.ts"
route('search.json', 'routes/search.ts'),
```

```ts title="react-router.config.ts"
export default { ssr: false, prerender: [...docsPrerender(), '/search.json'] } satisfies Config;
```

```tsx title="app/root.tsx"
<DocsDocument search={{ index: '/search.json' }}>{children}</DocsDocument>
```

A site served under a base path names the index with it (`/docs/search.json`). `DocsShell` then shows what opens the dialog:

| Where | What |
| --- | --- |
| Left column, under the name | a field, with the keys beside it |
| Top row, below 64rem | an icon |
| List of pages on a phone | the field, at its head |
| Anywhere | <kbd>⌘K</kbd>, <kbd>Ctrl+K</kbd>, <kbd>/</kbd> |

**What a query finds.** A page's index is its source read as the copy buttons read it, cut at its headings into paragraphs, list items, table rows and code blocks. A result is a page with up to three of its sections, and a section shows the text that matched.

| Typed | Finds | Because |
| --- | --- | --- |
| `key` | `keys`, `Key` | one word in any form |
| `instal` | `install`, `installation` | the last word is still being typed |
| `automerge` | `auto-merge`, `auto_merge` | a name written apart or together |
| `bedrok` | `bedrock` | one slip of the keys, when nothing else matches |
| `how do I pin a version` | pinning, versions | the words a question is asked with are dropped |

A title outranks a heading, a heading the description, the description text, and text code. On Pullfrog's 40 pages the index is 195 KB (60 KB gzipped). Chrome reads it in 15ms when it arrives and answers a keystroke in 2ms at most; with the CPU slowed four times, as on a mid-range phone, 52ms and 10ms.

**In the dialog.** The field keeps the focus. The arrow keys move the mark, Enter follows it (<kbd>⌘</kbd> or <kbd>Ctrl</kbd> with Enter in a new tab), and Escape or a press outside closes. The results are links, and the last query is still there, selected, when the dialog opens again. The dialog's script loads after the page and the index when a reader first reaches for the search.

> [!IMPORTANT]
> The results and the list of pages are Fumadocs links, which need the site's packages to share one `fumadocs-core`. With more than one, they render as plain anchors that reload the page and drop a base path. Pullfrog's docs resolved three until `lucide-react` and `zod`, peers of `fumadocs-core`, were dependencies of its own.

## How a third site adopts it

A Fumadocs site on Vite and React Router (`fumadocs-ui`, `fumadocs-core`, `fumadocs-mdx`, `fumadocs-twoslash`, `@shikijs/twoslash`, `react-router`, `@react-router/dev`, `@react-router/node`, `vite`, `@tailwindcss/vite`, Tailwind 4) adopts it in four steps:

1. Write its `docs.config.ts` ([The config](#the-config)), then sync: `node ~/Documents/docs-kit/src/sync.mjs <site>`.
2. Add `"docs-kit": "link:./docs-kit"` to its dependencies, and run `nub install`.
3. Set `"allowImportingTsExtensions": true` in its tsconfig, since fumadocs-mdx imports the build-time modules in Node itself, and they name their `.ts` extensions. Map `@/*` to `./*` and `collections/*` to `./.source/*`, fumadocs-mdx's generated collections, in its paths.
4. Add the page route and routes of [A site's config and routes](#a-sites-config-and-routes), and these files:

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

```ts title="source.config.ts"
import { defineConfig, defineDocs } from 'fumadocs-mdx/config';

// Imported inside the options, so only the build loads them (and TypeScript with them).
const mdxOptions = async (environment: 'bundler' | 'runtime') => (await import('docs-kit/mdx')).docsMdxOptions(environment, { twoslash: {} });

export const docs = defineDocs({ dir: 'content/docs', docs: { mdxOptions } });
export default defineConfig();
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

A long page splits into one MDX file per h2, so that an edit compiles one section: a second collection named `sections` (`defineCollections({ type: 'doc', dir: 'content/sections', mdxOptions })`), which `<DocsPage>` renders after the first page's own MDX in the order of the files' names, with their entries in the table of contents.

Reylo's `site/` is the full example: a page split into sections, its own remark plugin and Twoslash options (`lib/mdx-options.ts`), its own components (`components/mdx.tsx`), and its own link preview drawn at build time.
