# Motherload: the plan

Import a data file and get a typed module: `.toml`, `.yaml`/`.yml`, `.json5`, `.jsonc`, `.csv`, `.tsv`, `.txt`, `.md` and `.env` become modules of data with no run time, and `.schema.json` becomes the TypeScript type it describes plus a validator. One npm package of TypeScript 7.1 content mappers, with a preload and bundler plugins so the same import runs. The brand study behind the name is `docs/brands.md` in the porg repository (`~/Documents/projects/lando`), also copied to dotsql (`~/Documents/projects/dotsql/docs/brands.md`); [DESIGN.md](./DESIGN.md) records every decision taken while building the first version.

## Decisions

The maintainer's, Colin McDonnell, on 2026-10-03:

- **One npm package, Motherload,** of TypeScript 7.1 content mappers (plus bundler plugins and a preload) that type the data files a project imports: `.toml`, `.yaml`/`.yml`, `.json5`, `.jsonc`, `.env` and `.schema.json`, with `.csv`, `.tsv`, `.txt` and `.md` (with its frontmatter) added on 2026-10-06. The name's pun on "load" is deliberate.
- **A data file becomes a module of data with no run time,** so Motherload is a development dependency of an application that bundles.
- **A `.schema.json` file is a schema, not data:** it becomes its TypeScript type plus a validator, with the validator library (ajv) as an optional peer dependency.
- **The SQL loader is not part of Motherload.** It is its own product, dotsql (`~/Documents/projects/dotsql`), with each SQL dialect's engine in an add-on under `@dotsql`. A project that imports both lists both in its tsconfig, each with its own extensions.
- **Porg** (`~/Documents/projects/lando`, the porg repository) is the reactive Postgres driver, `pg_porg` and live queries.
- **The loader kit stays a template,** not a published package: [lab/universal](./lab/universal), copied here from dotsql because Motherload's mappers are its first users.
- **Build an initial working version,** deciding every design question and recording it in DESIGN.md, one section per decision; the maintainer iterates on the design afterwards.
- **A per-import choice between the parsed data and the raw text, and literal types as an opt-in,** with a query on the specifier (`?raw`, `?const`) proposed and to be verified against TypeScript first. It was: TypeScript does not resolve a specifier with a query, so the choice was by export name ([DESIGN.md](./DESIGN.md#how-an-import-chooses)); revised on 2026-10-06, below.

The maintainer's, on 2026-10-06:

- **The name is written Motherload,** capitalized, wherever a person reads it; `motherload` stays the package name in code.
- **The icon is three stacked gold bars,** an SVG (`site/app/icon.svg`, `site/public/motherload.svg`), used wherever the product shows an icon. The maintainer chose it on 2026-10-09 from sixteen drawn candidates, without the "M" its mockup carried; before it came the pickaxe emoji (it read poorly on the dark theme), a drawn chest and the treasure chest emoji (🪎).
- **The repository is public on GitHub,** at colinhacks/motherload.
- **The docs site is one page** with no persistent top bar (the name, GitHub and the theme switch sit in the left column, as on nub's docs), whose Loaders section has one heading per extension, each heading with a button that copies its link and one that copies the section as Markdown for an agent. It opens with what Motherload is, a note on content mappers, and a tabbed example importing several formats whose types show on hover. It shows no internal state (no status table, no "not built yet"), and its label is "beta". The GitHub link at the foot of the left column reads "GitHub", with nub's handwritten "Leave a star!" under it. Its type is IBM Plex Sans and IBM Plex Mono, and its colours are "Lantern": ash grays and amber by day, coal-black and amber by night, chosen over nine other palettes as the most evocative of gold. The hero's example is its import lines only, each imported name ruled with a dotted line to show it can be hovered. Its Errors section says only that a file's invalid data reaches the compiler as a type error, with tsc's own output; there is nothing to configure.
- **A data file's default export is typed as `as const` would type it,** and `?raw` gives the file's text, typed by `motherload/client` ([DESIGN.md](./DESIGN.md#the-module-an-import-returns)).
- **A YAML file of several documents stays the list of them,** typed the same as one document whose value is a list; no `documents` export ([DESIGN.md](./DESIGN.md#the-yaml-parser-yaml)).
- **A `.env` file is imported for its effect,** `import "./.env"`: its variables are set on `process.env` when the module runs and typed on `NodeJS.ProcessEnv`, with no value in a bundle ([DESIGN.md](./DESIGN.md#the-env-module)).

The maintainer's, on 2026-10-08 and 2026-10-09:

- **Motherload becomes a family of packages** released together at one version: a package per format under `@motherload` (`toml`, `yaml`, `json5`, `jsonc`, `env`, `csv`, `txt`, `md`, `schema`), each with its own mapper, preload, esbuild plugin and parser; `motherload`, the package of all of them, with one of each; and `@motherload/core`, the code they share, published as their dependency. Every dependency is at an exact version ([DESIGN.md](./DESIGN.md#packaging)).
- **`.schema.json` stays in Motherload,** as `@motherload/schema`, with ajv and ajv-formats as its dependencies and the validator still compiled when the module is built.
- **The per-format `dot<ext>` names stay reserved;** the `@motherload` scope replaces them.
- **A schema's types come from an emitter of Motherload's own** (`src/schema-types.ts`), not json-schema-to-typescript (15.9 MB with prettier) or json-schema-to-ts (the type computed again in every type check), so typing a schema needs nothing installed ([DESIGN.md](./DESIGN.md#the-schema-loader-types)).

## Names

On npm, held by the maintainer as 0.0.0 placeholders: `motherload`, `motherlode`, the scope `@motherload`, and the per-format names `dottoml`, `dotjson5`, `dotjsonc`, `dot-csv`, `dot-tsv`, `dotgraphql`, `dotgql`, `dotmdx`, `dotxml`, `dotproto`, `dotschema`, `dotsvg`, `dottxt`, `dotprisma`, `dotimport`, `dotimports`, `dotloads`, `dot-any`, `dot-ext`.

Held by other people, with transfer requests drafted and not sent: `dotyaml`, `dotyml`, `dotjson`, `dotmd`, `dotini`, `dotload`, `dot-loader`, `dotall`, `dotstar`, `dots`.

On GitHub the repository is public at [colinhacks/motherload](https://github.com/colinhacks/motherload), created on 2026-10-06; a dormant user (since 2015, no repositories) holds the account name `motherload`.

## Content mapper facts

Each was a lead from earlier research; each row says where it was confirmed. "Measured" means probe mappers in a scratch project, on TypeScript `7.1.0-dev.20260918.1` and `7.1.0-dev.20261002.1`, with the same behaviour on both ([DESIGN.md](./DESIGN.md#the-typescript-build)). The protocol is microsoft/typescript-go PR [#4712](https://github.com/microsoft/typescript-go/pull/4712).

| Fact | Confirmed |
| --- | --- |
| A tsconfig `contentMappers` entry is `{ package, extensions[], options? }` | The porg repository's `DESIGN.md` (its table of verified mapper facts); measured: entries without `options` work, and an entry's `options` reach `openProject` |
| TypeScript runs one process per mapper package and version | The porg repository's `docs/prior-art.md` section 4a, quoting the PR: processes are deduplicated "by resolved package name and version"; measured: two entries of one package start one process, which answers `openProject` once per entry |
| The process starts lazily | Measured: with no matching file in the program, a mapper without `dynamicConfig` started no process, with or without `--incremental` |
| One owner per extension | The porg repository's `docs/universal-plugin.md` section 1 (copied here as [docs/universal-plugin.md](./docs/universal-plugin.md)); measured: `TS100022` on 20260918.1, renumbered `TS18067` on 20261002.1 |
| The longest suffix wins, so `.schema.json` can belong to another mapper than `.json` | `docs/universal-plugin.md` section 1 (`GetLongestExtensionFromPath`); measured: `.config.toml` in one mapper and `.toml` in another, in both orders, each file reached its own mapper |
| `.json` itself cannot be claimed | Measured: `TS100021` / `TS18066`, "a built-in extension and cannot be registered by a content mapper"; `.schema.json` can be, beside `resolveJsonModule` |
| Plain `.json` is typed by `resolveJsonModule` | Measured: `{ port: number }` for `{ "port": 8080 }`; under `module: nodenext` an ES module needs `with { type: "json" }` (`TS1543` without it) |
| `dynamicConfig` is one flag per package | The porg repository's `DESIGN.md`: it sits in the package's `package.json` under `typescript.contentMapper`; its `docs/brands.md` ("The `dynamicConfig` flag is per package") |
| `tsc --incremental` opens dynamic mappers' projects | The porg repository's `docs/prior-art.md` section 4b, quoting the PR ("TypeScript uses `openProject` to obtain `configIdentity` before an up-to-date decision"); measured: a `dynamicConfig` mapper started and answered `openProject` on each `--incremental` run with no matching file present |
| The failure budget is 5 per mapper, and each tsconfig entry is its own mapper | The porg repository's `DESIGN.md` (the PR's text: "after five failures in a project tsc stops calling that mapper") and `docs/brands.md` (per entry, read in the source, not run); measured: one entry with seven failing files gave five failed transforms and then the switched-off diagnostic, while the same package in two entries took four failures each without being switched off |
| A transform request carries only `fileName`, `content` and `projectHandle` | Measured; `openProject` carries `configFileName`, `projectHandle`, `compilerOptions`, and `options` when the entry has them |
| A scoped package (`@probe/loader`) is a content mapper like any other | Measured on 20261002.1: its tsconfig entry started its mapper, which typed a `.toml` import |
| A specifier with a query (`./x.toml?raw`) does not resolve to the file, so the mapper never sees it | Measured: `TS2307` on both builds; an ambient `declare module "*.toml?raw"` types it instead (measured on 20261002.1); details in [DESIGN.md](./DESIGN.md#how-an-import-chooses) |

## What works

Run `nub install`, then `nub run typecheck` and `nub run test` (57 tests). The suite type-checks [lab/basic](./lab/basic) through the content mapper with exact-type assertions and a failing control, checks diagnostics placed in broken files, runs `lab/basic` under the preload, and bundles it with the esbuild plugin into a file that imports nothing. [AGENTS.md](./AGENTS.md) lists the layout.

## Steps

1. **The template, the package and the plan** (done on 2026-10-03).
2. **The mapper core from the template** (done on 2026-10-03): the contract in `src/universal.ts` and the server in `src/rpc.ts`, with the changes listed in [DESIGN.md](./DESIGN.md#the-starting-point-the-loader-template).
3. **Each format** (done on 2026-10-03): TOML, YAML, JSON5, JSONC and `.env`, each with a parser chosen in DESIGN.md. CSV, TSV, text and Markdown with frontmatter added on 2026-10-06 ([DESIGN.md](./DESIGN.md#the-csv-and-tsv-module)).
4. **The schema loader** (done on 2026-10-03): a validator compiled by ajv when the module is built, ajv an optional peer; the types from json-schema-to-typescript, an optional peer too until 2026-10-09, and since then from Motherload's own emitter.
5. **Bundler plugins and the preload:** the preload (`motherload/register`) and esbuild (`motherload/esbuild`) are done. Next: Vite, Rollup and Rolldown through the template's unplugin adapter, webpack, Rspack and Turbopack through its webpack-loader adapter, Bun run for real, and a Jest transformer as dotsql has (a preload does not reach Jest's test code, [DESIGN.md](./DESIGN.md#what-runs-where)). Each needs a lab project that runs it.
6. **The package family and a build to `dist/`** for publishing: the split into `@motherload/core`, nine format packages and `motherload` ([DESIGN.md](./DESIGN.md#packaging)), and compiled JavaScript and declarations for each, because today `exports` and the mapper's `exec` point at the TypeScript sources, which Node runs directly, as dotsql's repository does.
7. **Docs and a launch:** a README for users, a docs site (a first draft of one page is in [site/](./site), for the maintainer to review), the first release from `"private": true` to published.

## Open

- **`.env` files:** whether to expand `${VAR}` as nub does; how a project claims `.env.local` and `.env.production`, whose suffixes are not `.env`.
- **TOML date-times:** local dates and times are ISO strings and offset date-times are `Date`s; Temporal types (`Temporal.PlainDate` and the rest) are the alternative once every target runtime has Temporal.
- **The validator peer for `.schema.json`:** ajv is the maintainer's choice and is built in; whether to accept others (a Standard Schema validator generated by another library), and whether `parse` should throw a `TypeError` or an error class of Motherload's.
- **JSON Schema `$ref` to other files:** following them needs the mapper to watch those files (`dynamicConfig` with `watchedFiles`), which costs a process on every `--incremental` run.
- **JSONC trailing commas:** allowed today; whether a `.jsonc` file should be refused for them.
- **CSV quoting in TSV:** a `.tsv` file follows the IANA registration, with no quoting; whether the TSV that spreadsheets export puts quotes around a field that holds a tab or a line break, and so needs CSV quoting, is unverified.
- **Large CSV files in a bundle:** each row is an object literal that repeats every column name; an array of arrays mapped to objects when the module runs would be smaller.
- **Markdown:** whether `.mdx` should be claimed, and whether a `+++` TOML frontmatter (Hugo's) should be read.
- **Vite and `.schema.json`:** Vite treats ids ending in `.json` as JSON; whether its JSON handling runs on the module Motherload returns is unverified.
- **The built-in data loaders of nub** cover `.toml`, `.yaml`, `.json5` and `.jsonc` with a default export only; whether nub should read Motherload's preload from its package (the template's `nub` manifest proposal in docs/universal-plugin.md section 5).
- **The TypeScript nightly:** the repository pins `7.1.0-dev.20261002.1`; the content mapper diagnostic codes changed between nightlies, so tests match messages, not codes.
