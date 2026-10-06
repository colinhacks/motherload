# Motherload: the plan

Import a data file and get a typed module: `.toml`, `.yaml`/`.yml`, `.json5`, `.jsonc` and `.env` become modules of data with no run time, and `.schema.json` becomes the TypeScript type it describes plus a validator. One npm package of TypeScript 7.1 content mappers, with a preload and bundler plugins so the same import runs. The brand study behind the name is `docs/brands.md` in the porg repository (`~/Documents/projects/lando`), also copied to dotsql (`~/Documents/projects/dotsql/docs/brands.md`); [DESIGN.md](./DESIGN.md) records every decision taken while building the first version.

## Decisions

The maintainer's, Colin McDonnell, on 2026-10-03:

- **One npm package, Motherload,** of TypeScript 7.1 content mappers (plus bundler plugins and a preload) that type the data files a project imports: `.toml`, `.yaml`/`.yml`, `.json5`, `.jsonc`, `.env` and `.schema.json`. The name's pun on "load" is deliberate.
- **A data file becomes a module of data with no run time,** so Motherload is a development dependency of an application that bundles.
- **A `.schema.json` file is a schema, not data:** it becomes its TypeScript type plus a validator, with the validator library (ajv) as an optional peer dependency.
- **The SQL loader is not part of Motherload.** It is its own product, dotsql (`~/Documents/projects/dotsql`), with each SQL dialect's engine in an add-on under `@dotsql`. A project that imports both lists both in its tsconfig, each with its own extensions.
- **Porg** (`~/Documents/projects/lando`, the porg repository) is the reactive Postgres driver, `pg_porg` and live queries.
- **The loader kit stays a template,** not a published package: [lab/universal](./lab/universal), copied here from dotsql because Motherload's mappers are its first users.
- **Build an initial working version,** deciding every design question and recording it in DESIGN.md, one section per decision; the maintainer iterates on the design afterwards.
- **A per-import choice between the parsed data and the raw text, and literal types as an opt-in,** with a query on the specifier (`?raw`, `?const`) proposed and to be verified against TypeScript first. It was: TypeScript does not resolve a specifier with a query, so the choice is by export name ([DESIGN.md](./DESIGN.md#how-an-import-chooses)).

The maintainer's, on 2026-10-06:

- **The name is written Motherload,** capitalized, wherever a person reads it; `motherload` stays the package name in code.
- **The icon is the pickaxe emoji (⛏️),** used wherever the product shows an icon.
- **The repository is public on GitHub,** at colinhacks/motherload.
- **The docs site is one page** whose Loaders section has one heading per extension, each heading with a button that copies its link and one that copies the section as Markdown for an agent.

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
| A specifier with a query (`./x.toml?raw`) does not resolve | Measured: `TS2307` on both builds; details in [DESIGN.md](./DESIGN.md#how-an-import-chooses) |

## What works

Run `nub install`, then `nub run typecheck` and `nub run test` (33 tests). The suite type-checks [lab/basic](./lab/basic) through the content mapper with exact-type assertions and a failing control, checks diagnostics placed in broken files, runs `lab/basic` under the preload, and bundles it with the esbuild plugin into a file that imports nothing. [AGENTS.md](./AGENTS.md) lists the layout.

## Steps

1. **The template, the package and the plan** (done on 2026-10-03).
2. **The mapper core from the template** (done on 2026-10-03): the contract in `src/universal.ts` and the server in `src/rpc.ts`, with the changes listed in [DESIGN.md](./DESIGN.md#the-starting-point-the-loader-template).
3. **Each format** (done on 2026-10-03): TOML, YAML, JSON5, JSONC and `.env`, each with a parser chosen in DESIGN.md.
4. **The schema loader** (done on 2026-10-03): types from json-schema-to-typescript and a validator compiled by ajv when the module is built, both optional peers.
5. **Bundler plugins and the preload:** the preload (`motherload/register`) and esbuild (`motherload/esbuild`) are done. Next: Vite, Rollup and Rolldown through the template's unplugin adapter, webpack, Rspack and Turbopack through its webpack-loader adapter, Bun run for real, and a Jest transformer as dotsql has. Each needs a lab project that runs it.
6. **A build to `dist/`** for publishing: today `exports` and the mapper's `exec` point at the TypeScript sources, which Node runs directly, as dotsql's repository does; the published package needs compiled JavaScript and declarations.
7. **Docs and a launch:** a README for users, a docs site (a first draft of one page is in [site/](./site), for the maintainer to review), the first release from `"private": true` to published.

## Open

- **The `.env` module:** whether a module should read `process.env` at run time with the file as its defaults, instead of carrying the file's values (which a browser bundle then holds); whether to expand `${VAR}` as nub does; how a project claims `.env.local` and `.env.production`, whose suffixes are not `.env`.
- **YAML multi-document files:** a file of several documents is the list of them, and a file of one document whose value is a list reads the same; a separate export (`documents`) would tell them apart.
- **TOML date-times:** local dates and times are ISO strings and offset date-times are `Date`s; Temporal types (`Temporal.PlainDate` and the rest) are the alternative once every target runtime has Temporal.
- **The per-format `dot<ext>` names:** whether they become aliases of Motherload (`dottoml` installs Motherload and claims `.toml`) or stay reserved.
- **The validator peer for `.schema.json`:** ajv is the maintainer's choice and is built in; whether to accept others (a Standard Schema validator generated by another library), and whether `parse` should throw a `TypeError` or an error class of Motherload's.
- **JSON Schema `$ref` to other files:** following them needs the mapper to watch those files (`dynamicConfig` with `watchedFiles`), which costs a process on every `--incremental` run.
- **JSONC trailing commas:** allowed today; whether a `.jsonc` file should be refused for them.
- **Vite and `.schema.json`:** Vite treats ids ending in `.json` as JSON; whether its JSON handling runs on the module Motherload returns is unverified.
- **The built-in data loaders of nub** cover `.toml`, `.yaml`, `.json5` and `.jsonc` with a default export only; whether nub should read Motherload's preload from its package (the template's `nub` manifest proposal in docs/universal-plugin.md section 5).
- **The TypeScript nightly:** the repository pins `7.1.0-dev.20261002.1`; the content mapper diagnostic codes changed between nightlies, so tests match messages, not codes.
