# Motherload with Next.js

A Next.js 16.4 App Router app whose server component and client component import a TOML file, a CSV file and a Markdown file as typed modules, built by Motherload's loader under Turbopack and under webpack ([Next.js](https://motherload.dev/#setup-nextjs)).

## Run it

```sh
nub run typecheck       # next typegen, then tsc --noEmit --runExternalCode: "✓ Types generated successfully", exit 0
nub run dev             # next dev (Turbopack) on http://localhost:3000; nub run dev:webpack for webpack
nub run build           # the type check, then next build (Turbopack): "○ /", prerendered as static content
nub run start           # next start on http://localhost:3000
nub run build:webpack   # the same build with webpack; then nub run start
```

With `dev` or `start` running, the page shows the values twice, once from the server component and once from the client component:

```text
$ curl -s localhost:3000 | grep -o '<pre id="[a-z]*">[^<]*</pre>'
<pre id="server">{&quot;title&quot;:&quot;Motherload example&quot;,&quot;port&quot;:8080,&quot;users&quot;:[&quot;Ada Lovelace&quot;,&quot;Hopper, Grace&quot;],&quot;post&quot;:&quot;Hello, Motherload&quot;}</pre>
<pre id="client">{&quot;title&quot;:&quot;Motherload example&quot;,&quot;port&quot;:8080,&quot;users&quot;:[&quot;Ada Lovelace&quot;,&quot;Hopper, Grace&quot;],&quot;post&quot;:&quot;Hello, Motherload&quot;}</pre>
```

After either build, the same two lines are in the prerendered page, `.next/server/app/index.html`, and the values are in the browser's code under `.next/static/chunks/`, as plain objects with no parser beside them.

## How Motherload is wired in

- In `package.json`, `motherload` is a development dependency: the loader builds each data file into a module at build time, and nothing of Motherload runs in the app. TypeScript 7.1 beta and `@types/node` (for `next.config.ts`) are development dependencies too. The `typecheck` script is `next typegen && tsc --noEmit --runExternalCode`: `next typegen` writes the route types `LayoutProps` reads, and `--runExternalCode` lets `tsc` run the content mapper. The `build` and `build:webpack` scripts run the same check before `next build`.
- In `next.config.ts`, `typescript.ignoreBuildErrors` turns off `next build`'s own type check, which runs `tsc` without `--runExternalCode` and so fails on every data import; the build script has run the real check by then. The key `"*.{toml,csv,md}"` in `turbopack.rules` sends each data file through `motherload/turbopack`, with `as: "*.js"` so that Turbopack reads the loader's output as JavaScript. The `webpack()` hook adds the same loader, `motherload/webpack`, for `--webpack`. The option `turbopack.root` exists only because the example sits inside this repository (below).
- In `tsconfig.json`, `contentMappers` names `motherload` for `.toml`, `.csv` and `.md`, the three formats the app imports; the rest is what `create-next-app` writes.
- The module `site.ts` imports `config.toml`, `users.csv` and `post.md` and reads a value from each. The server component `app/page.tsx` renders it, with a `@ts-expect-error` on a key `config.toml` does not have, and so does the client component `app/client-site.tsx` (`"use client"`), whose copy of the data goes to the browser.
- The `.vscode/` and `.zed/` directories hold the editor settings from [Editors](https://motherload.dev/#editors).

## In your own project

- Run `npm install -D motherload typescript@beta @types/node` instead of the `link:` dependency on `../..`.
- Drop `turbopack.root` from `next.config.ts`. It points Turbopack at this directory because the repository's own `pnpm-lock.yaml`, two levels up, would otherwise make Next.js take the repository for the workspace root.
- List every format the app imports, in the Turbopack key, the webpack `test` and `tsconfig.json`, but never `.env`: Next.js loads `.env` files itself.

## Notes

- **Without the loader,** `next build` stops at the first data file: Turbopack says `./config.toml` is an "Unknown module type", webpack that `./post.md` needs "an appropriate loader".
- **The `AGENTS.md` file** is what `next dev` writes for coding agents (turned off with `agentRules: false`); it is kept so that running the app leaves no new file.
