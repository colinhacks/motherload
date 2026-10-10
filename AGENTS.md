# Agent notes

Read [PLAN.md](./PLAN.md) first: what Motherload is, what the maintainer decided, the content mapper facts and where each was confirmed, the steps, and what is open. [DESIGN.md](./DESIGN.md) holds one section per design decision with its alternatives and evidence; a change to a decision updates its section.

The Motherload package types data-file imports (`.toml`, `.yaml`/`.yml`, `.json5`, `.jsonc`, `.env`, `.csv`, `.tsv`, `.txt`, `.md`) and `.schema.json` imports (a type plus a validator): a TypeScript 7.1 content mapper, a preload and bundler plugins. Its sibling products are dotsql (`~/Documents/projects/dotsql`, the `.sql` loader) and porg (`~/Documents/projects/lando`, the porg repository: the reactive Postgres driver, `pg_porg` and live queries). Read those repositories; do not write to them.

## Layout

| Path | What it is |
| --- | --- |
| `src/formats.ts` | One parser per format, each returning a value or problems placed in the text |
| `src/serialize.ts` | A parsed value as JavaScript, as a widened type and as a literal type |
| `src/data.ts`, `src/schema.ts` | The module a data file, a `.env` file and a `.schema.json` file become |
| `src/plugin.ts` | The loader: each path to its format |
| `src/universal.ts`, `src/rpc.ts` | The loader contract, its adapters (Node hooks, Bun, esbuild, the content mapper) and the JSON-RPC server, from the template |
| `src/mapper.ts`, `src/register.ts`, `src/esbuild.ts` | The entry points: the content mapper process, the preload, the esbuild plugin |
| `src/index.ts` | The types generated modules refer to (`Schema`, Standard Schema v1) |
| `src/client.d.ts` | The ambient types of `?raw` imports, which a project lists in tsconfig's `types` as `motherload/client` |
| `tests/` | The node tests, including the end-to-end checks of `lab/basic`; `tests/fixtures/errors` is a project of broken files |
| `lab/basic/` | A project that imports every format, type-checked through the content mapper, run under the preload, bundled with esbuild |
| `lab/universal/`, `docs/universal-plugin.md` | The loader template and its research note, copied from dotsql; kept as they were |
| `site/` | The docs site, one page (`site/content/docs/index.mdx`), on the dotsql site's stack (Next.js, Fumadocs, Twoslash) with the table of contents on the left; a project of its own, with its own lockfile. Its type hovers come from Motherload's mapper, run on the page's own example files at build time (`site/lib/remark-mapper.ts`) |

The root `package.json` links `motherload` to the repository root (`link:.`), because a mapper package does not resolve through self-reference, and links the template's `universal-toml` and `universal-toml-2` the same way.

## JavaScript: nub

Prefer `nub` over `node`, `bun`, `npm`, `npx`, `pnpm` and `yarn`: run files with `nub <file>`, package scripts with `nub run <script>`, local CLIs with `nubx <tool>`, installs with `nub install` and `nub add`. The lockfile (`pnpm-lock.yaml`) is respected both ways. Use `nub --node <file>` for strict, unaugmented Node; nub's own loaders for `.toml`, `.yaml`, `.json5` and `.jsonc` are off there, which is what a check of Motherload's preload wants.

- Running `nub run typecheck` type-checks the sources and runs the content mapper on `lab/universal/app` and `lab/basic` (`tsc --runExternalCode`).
- Running `nub run test` runs `tests/**/*.test.ts` with `node --test`.
- Running `nub run dev` in `site/` serves the docs site on port 3312; `nub run build` there fails when a page example stops type-checking.
- Setting `TS_CONTENT_MAPPER_DEBUG=1` on `nubx tsc -p lab/basic/tsconfig.json --noEmit --runExternalCode` prints the JSON-RPC traffic.
- The nub installer refuses a package version younger than 24 hours (`minimumReleaseAge`); the TypeScript nightly is pinned to one that passed it. Do not bypass the gate.

## Writing conventions

The product is Motherload, capitalized, in prose and in every message a user reads; `motherload` is the npm package, the import specifier, the diagnostic source and the Standard Schema vendor, always as code. Its icon is three stacked gold bars, drawn as an SVG (`site/app/icon.svg`, the favicon, and the same drawing in `site/public/motherload.svg`): the site's favicon, the top of its left column, and the README's title. Never hard-wrap Markdown: every paragraph, list item and table row is one line. Never estimate developer time. Anything stated as fact traces to a file read or a command run; a guess goes in PLAN.md's Open section as a question. Call the repository at `~/Documents/projects/lando` the porg repository.
