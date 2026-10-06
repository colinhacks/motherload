# Motherload: design record

Each section is one decision: what was decided, the alternatives weighed, and the evidence. Decisions taken on 2026-10-03 while building the first working version, under the maintainer's instruction to decide and record rather than ask; the maintainer iterates on them from here. What could not be settled is in [PLAN.md](./PLAN.md#open). Measurements were taken on macOS with Node v26.10.0 and nub v0.9.5; "measured" means a command in this repository or in a scratch directory was run and its output read.

## The module an import returns

A data file (`.toml`, `.yaml`, `.yml`, `.json5`, `.jsonc`, `.env`) becomes a module with three exports:

```ts
import config from "./app.toml";        // the data, widened: { port: number; name: string }
import { literal } from "./app.toml";   // the same object, typed as `as const`: { readonly port: 8080; readonly name: "demo" }
import { raw } from "./app.toml";       // the file's text: string
```

- **The default export is widened,** because that is how TypeScript's `resolveJsonModule` types a `.json` import, which users already know: `lab/basic/main.ts` checks that `import plain from "./plain.json" with { type: "json" }` is `{ port: number }`, and every Motherload default export follows the same rule (a literal widens to its primitive, an array to an array of the union of its items, `[]` to `never[]`). A package.json-like file typed `as const` is rarely wanted.
- **The `literal` export is the opt-in for literal readonly types,** for a config file whose exact values matter. It is the same object as the default export, not a copy, so a module's data is held once; the readonly type is a view, as `as const` is. A copy, deep-frozen, was the alternative; it doubles what the preload holds for every data file.
- **The `raw` export is the file's text, `string`,** the meaning of Vite's `?raw`. An unused `raw` costs nothing in a bundle: measured with the esbuild plugin, a bundle of `import config from "./config.toml"` holds none of the file's text, minified or not.
- **No top-level keys as named exports.** Node's JSON modules export only `default`, and a key such as `raw` or `my-key` would collide with the exports above or not be an identifier.
- **A `.env` module has no `literal`.** Its literal type would put each value, often a secret, into the type text, which editor hovers show, and with `--declaration` TypeScript writes declaration files from a mapped file's transformed content (the content mapper PR's text, quoted in the porg repository's `docs/prior-art.md` section 4c). `tests/data.test.ts` checks that no value reaches the type text.

## How an import chooses

The maintainer's idea was a query on the specifier, as in Vite (`./app.toml?raw`, `?const`). Measured with a probe mapper that reports what it receives, on TypeScript `7.1.0-dev.20260918.1` and `7.1.0-dev.20261002.1`:

| Mechanism | TypeScript | What the mapper sees |
| --- | --- | --- |
| Query, `import x from "./y.toml?raw"` | `TS2307: Cannot find module './y.toml?raw'` on both builds | Nothing; no transform |
| Hash, `"./y.toml#raw"` | `TS2307` on both builds | Nothing |
| Import attributes, `with { type: "text" }` or `with { as: "const" }` | Accepted, exit 0 | The transform request carries `fileName`, `content` and `projectHandle` only, so the attribute cannot change the module; one module per file |
| Ambient wildcard, `declare module "*?raw" { const text: string; export default text }` | Accepted; the import is `string` (an `@ts-expect-error` assigning it to `number` is used) | Nothing; the ambient declaration answers, and it cannot see the file, so it cannot type `?const` |
| Named exports (`literal`, `raw`) | Typed per file by the mapper | Everything; the mapper writes all three |

At run time a query does reach the loaders: Node's module hooks resolve `./config.toml?raw` and the template's load hook loaded it (exit 0), and esbuild resolved it to `config.toml`, keeping `?raw` apart in its `suffix`. So a query works everywhere except in the type check, and a design TypeScript cannot type was not shipped.

- **Decided: the import chooses by export name.** It is the one mechanism the type check, the preload and every bundler agree on.
- **A query is left alone.** The preload's hook and the esbuild plugin pass an import with `?` or `#` to the next hook or plugin instead of loading the data module (`tests/adapters.test.ts`), so `./app.toml?raw` under Vite gets Vite's own `?raw`, typed by its own ambient declaration, and elsewhere fails plainly instead of returning data where a `string` was declared.
- **Rejected: an option per tsconfig entry** (`options: { literal: true }`, or a second entry for a suffix such as `.const.toml`). Both choose per file or per suffix, not per import, and the second makes users rename files.

## The TOML parser: smol-toml

| Candidate | Latest release | Weekly downloads | Spec | Notes |
| --- | --- | --- | --- | --- |
| smol-toml | 1.9.0, 2026-09-22 | 45.4 M | TOML 1.1.0; "passing all tests from the official toml-test suite" (its README; the footnote: some invalid datetimes are accepted, and full type preservation needs `integersAsBigInt`) | No dependencies, 0.14 MB |
| toml | 5.0.0, 2026-07-14 | 32.4 M | TOML 1.1.0, 702 of 708 toml-test cases (its README) | No dependencies |
| @iarna/toml | 2.2.5, 2020-04-22 | 9.8 M | TOML 1.0.0-rc.1 (its README) | Unmaintained since 2020 |
| @ltd/j-toml | 1.38.0, 2023-01-16 | 0.28 M | | LGPL-3.0 |

Downloads and releases from the npm registry and downloads API on 2026-10-03. The smol-toml parser passes the whole suite, is the most used, and is maintained. Options: `integersAsBigInt: "asNeeded"`, so an integer past 2^53 is a `bigint` (typed `bigint`) instead of a rounded number, and the default `TomlDate`, whose `isLocal()` tells the four TOML date kinds apart. A parse error carries `line` and `column`, which become the diagnostic's place.

## TOML dates

- **An offset date-time is a `Date`** (`new Date(...)` in the module, `Date` in both types): it names an instant.
- **A local date-time, local date or local time is its ISO text** (`"1979-05-27"`, `"1979-05-27T07:32:00.000"`, `"07:32:00.000"`), typed `string`: none names an instant, and a `Date` would invent a time zone. The text is smol-toml's `toISOString()`, which adds milliseconds to a time (`tests/formats.test.ts`).
- Temporal (`Temporal.PlainDate` and the rest, which smol-toml can return) was the alternative; it needs Temporal wherever the module runs. It is in [PLAN.md](./PLAN.md#open).

## The YAML parser: yaml

| Candidate | Latest release | Weekly downloads | Spec | Notes |
| --- | --- | --- | --- | --- |
| yaml (eemeli) | 2.9.1, 2026-09-11 | 258 M | YAML 1.1 and 1.2; "passes all of the yaml-test-suite tests" (its README) | No dependencies, 0.69 MB; errors carry a `[start, end]` range |
| js-yaml | 5.4.2, 2026-09-13 | 363 M | YAML 1.2 and 1.1; "passes the entire YAML Test Suite" (its README) | Depends on argparse, 1.57 MB |

Both pass the suite and are maintained. yaml was chosen for its error ranges (a diagnostic underlines the whole offending token) and its document API, with no dependencies. Its behaviour, each checked in `tests/formats.test.ts` or `lab/basic`:

- **YAML 1.2's core schema,** the library's default, so `yes` is the string `"yes"`.
- **Merge keys (`<<`) are read** (`merge: true`), so a file can share a block of settings between sections (`lab/basic/app.yaml`).
- **A duplicate key is an error,** the library's default.
- **Several documents (`---`) are the list of their values,** in order, typed as an array of their union; one document is its value; a file with no document is `null`. Refusing a multi-document file was the alternative; it would make a whole class of files unimportable. A single document whose value is a list reads the same as several documents, which is in [PLAN.md](./PLAN.md#open).
- A YAML value no module can carry (`!!binary`, `!!set`, a Map with object keys under YAML 1.1) is a diagnostic naming its path.

## The JSON5 parser: json5

The json5 package, 2.2.3 (2022-12-31, 284 M weekly downloads, no dependencies), is published by the JSON5 project itself (github.com/json5/json5); no other JSON5 parser was found worth weighing. Its `SyntaxError` carries `lineNumber` and `columnNumber`. It keeps a `__proto__` key as a property (measured).

## The JSONC parser: jsonc-parser

| Candidate | Latest release | Weekly downloads | Notes |
| --- | --- | --- | --- |
| jsonc-parser (Microsoft) | 3.3.1, 2024-06-24 | 85 M | A scanner and fault-tolerant parser for JSON with comments (its README); errors with offset and length |
| strip-json-comments | 5.0.3, 2025-08-08 | 259 M | Removes comments for `JSON.parse`; no positions of its own |
| comment-json | 5.0.0, 2026-04-12 | 20 M | Keeps comments for round-trips; depends on esprima |

The jsonc-parser package is the only candidate that parses JSONC itself and places its errors. Trailing commas are allowed (`allowTrailingComma: true`), since a hand-edited `.jsonc` file collects them; whether to refuse them is in [PLAN.md](./PLAN.md#open). The value is built from `parseTree`, not from the library's `parse`: `parse` assigns keys, and a `"__proto__"` key then sets the prototype instead of becoming a property (measured: `parse('{"__proto__": 1, ...}')` lost the key). The schema loader reads strict JSON with the same parser, comments and trailing commas off.

## The `.env` parser: dotenv

The dotenv package, 18.0.5 (2026-09-30, 223 M weekly downloads, no dependencies), was compared with Node's built-in `util.parseEnv`: on sixteen lines covering plain, double-quoted (with `\n`), single-quoted, inline comments, multi-line, `export`, backticks, empty, spaced, `${A}`, a quoted `#`, `=` in a value, a key starting with a digit and a dotted key, both gave the same values (measured). dotenv was chosen because its version is pinned by the lockfile, while `util.parseEnv` changes with the Node that runs the type check.

- **No expansion:** `${A}` stays the text `${A}`, as in both parsers. nub expands `${VAR}` when it loads `.env` (nub's documentation); whether Motherload should is in [PLAN.md](./PLAN.md#open).
- **Every value is a string,** so the type is `{ KEY: string }` with the file's keys.
- **File names:** a `.env` entry in tsconfig matches a file named `.env` (measured: TypeScript transformed `./.env` for a probe mapper claiming `.env`) and, by the suffix rule, `prod.env`. `.env.local` ends in `.local`, which no `.env` entry reaches; the loaders recognise `.env.*` names if an entry claims their suffix.
- **The module carries the values.** A `.env` imported into browser code puts its values in the bundle; the README says so.

## The schema loader: types

A `.schema.json` file becomes the type the schema describes plus a validator (the maintainer's decision). The types come from json-schema-to-typescript 16.0.0 (2026-08-28, 5.1 M weekly downloads), which compiles a schema to TypeScript declarations; json-schema-to-ts (type-level inference from a schema literal, 47 M weekly downloads, last release 2024-08-29) was the alternative, and it needs the schema as a literal type in user code and a library at type-check time. Writing a small emitter was the other alternative; it would cover fewer keywords and be Motherload's to maintain.

- **An optional peer dependency, not a dependency.** Measured from the npm registry's unpacked sizes: the five parsers total 1.33 MB, and json-schema-to-typescript with its dependencies (prettier 9.96 MB, lodash, two js-yaml majors, @apidevtools/json-schema-ref-parser) 15.9 MB, 92 percent of the 17.2 MB Motherload would otherwise install. Only `.schema.json` imports need it, and they need ajv too, so both are installed together. Without it the schema's types are `any` and a diagnostic says what to install.
- **The root type is always `Type`:** the root `title` is removed before compiling, so `import { type Type as User }` works for every schema; nested definitions keep their titles and are exported too.
- **A schema is one file:** `$ref` to another file or a URL is not followed (`$refOptions: { resolve: { file: false, http: false } }`), and is a diagnostic. Following file references needs the mapper to watch those files (`dynamicConfig`, below), which is in [PLAN.md](./PLAN.md#open).
- **The schema itself is checked:** when ajv is installed, the type check compiles the schema and reports an invalid one (`tests/fixtures/errors`).

## The schema loader: the validator

```ts
import user, { type Type as User } from "./user.schema.json";
user.parse(input);              // User, or a TypeError whose `issues` lists every problem
user.is(input);                 // input is User
user["~standard"].validate(x);  // Standard Schema v1
user.schema;                    // the JSON Schema, typed as a literal
```

- **The ajv validator, as an optional peer dependency** (the maintainer's decision names ajv). Version 8.20.0 (2026-04-24, 464 M weekly downloads) validates drafts 06, 07, 2019-09 and 2020-12; the draft comes from `$schema` (`ajv/dist/2019`, `ajv/dist/2020`), and draft-04 is refused with a diagnostic. ajv-formats, also an optional peer, validates `format` when installed; without it `format` is not checked.
- **Compiled when the module is built,** with ajv's standalone code, so the module needs no validator library at run time and no `new Function`. Measured: standalone code `require`s run-time helpers (`ajv/dist/runtime/ucs2length` for `minLength`, `equal` for `uniqueItems` over objects), even with `code: { esm: true }`; Motherload inlines each required CommonJS module, transitively, into the module, so the generated module imports nothing. The esbuild bundle of `lab/basic` has no `node_modules` input and runs with nothing installed (`tests/lab.test.ts`).
- **Options:** `allErrors: true`, so a failure lists every issue; `strict: false` and no logger, so a schema written for another validator still compiles.
- **Without ajv** the types still work, and building or preloading the module fails with a message that names ajv.
- **Standard Schema v1:** the default export implements `~standard` (vendor `motherload`) for any library that accepts one; the interface is copied into `src/index.ts`, so the types depend on no package. The brand study's consequence that "a module that exposes `~standard` plugs into every Standard Schema consumer" is the reason.
- **The module imports nothing from Motherload,** so Motherload stays a development dependency (the condition in the porg repository's `docs/brands.md`); the generated `.ts` text imports types from `motherload`, which the type check resolves.

## Values a module carries

The serializer (`src/serialize.ts`) writes each parsed value as JavaScript and as two type texts. Beyond JSON: `NaN`, `Infinity`, `-Infinity` and `-0` (YAML `.inf`, JSON5 `Infinity`, TOML `nan`), `bigint` (`123n`), and `Date`. A `"__proto__"` key is written as a computed key, because `{"__proto__": x}` in an object literal sets the prototype (`tests/serialize.test.ts`). Literal types: `NaN` and the infinities are `number`, as TypeScript has no literal type for them. Anything else (a Map, a Set, bytes, `undefined`) is a diagnostic naming its path.

## Diagnostics

- **Positions are UTF-8 bytes.** The mapper declares `positionEncoding: "utf-8"` in `initialize`, as the template and dotsql's mapper do, and dotsql's mapper places its diagnostics in UTF-8 bytes; the parsers report UTF-16 offsets, so the mapper converts them (`utf8Range`). The template passed UTF-16 offsets through, which places an error after a non-ASCII character too early. Measured: `tests/fixtures/errors/broken.toml`, whose first line holds `é`, reports `broken.toml(2,8)`.
- **Codes** (shown as `motherload<code>`): 1 syntax, 2 a value no module can carry, 3 a file whose suffix Motherload does not read, 4 the schema, 5 an option in tsconfig.
- **A file that does not parse is typed `any`.** The diagnostic in the file fails the type check already; `any` keeps every use of the import from adding errors of its own. The template typed it `never`, and dotsql types a failed analysis `unknown`.

## The mapper process

- **No `dynamicConfig`.** A data file's module depends on the file alone, and a schema's on the file and the installed peers. Without the flag TypeScript computes the transform identity from the package name and version and the tsconfig options without starting the process (the content mapper PR's text, quoted in the porg repository's `docs/prior-art.md` section 4b), and starts it only for a matching file. Measured with probe mappers on both builds: a static mapper with no matching file in the program started no process, with or without `--incremental`, while a `dynamicConfig` mapper started and answered `openProject` on every `--incremental` run, with no matching file present.
- **No options.** A key in a tsconfig entry's `options` is reported (code 5) through `optionDiagnostics`, the field dotsql's mapper uses.
- **One tsconfig entry for every format.** TypeScript starts one process per package and version (measured: two entries of one package, one process, each entry its own `openProject` with its own `options`). The failure budget is per entry (below), so a project that wants one format's failures kept apart from the others' lists that format in an entry of its own.
- **Plain `.json` stays TypeScript's:** a mapper cannot claim it (`TS100021` on `7.1.0-dev.20260918.1`, `TS18066` on `7.1.0-dev.20261002.1`: "a built-in extension and cannot be registered"), and `.schema.json` can be claimed beside it (measured: the probe mapper transformed `user.schema.json` while `plain.json` was typed by `resolveJsonModule`).

## The TypeScript build

The repository pins `typescript@7.1.0-dev.20261002.1`, the newest nightly older than nub's 24-hour minimum release age on 2026-10-03 (`7.1.0-dev.20261003.1` was refused with `ERR_NUB_NO_MATURE_MATCHING_VERSION`). dotsql uses `7.1.0-dev.20260918.1`. Every probe below ran on both, with the same behaviour; the content mapper diagnostic codes were renumbered between them:

| Diagnostic | 20260918.1 | 20261002.1 |
| --- | --- | --- |
| A built-in extension (`.json`) | TS100021 | TS18066 |
| An extension in two mappers | TS100022 | TS18067 |
| Mappers without `--runExternalCode` | TS100024 | TS18068 |
| A failed transform | TS100025 | TS18069 |
| A mapper switched off after five failures | TS100026 | TS18070 |

Failure budget, measured with a mapper that throws for files named `fail*`: one entry, seven failing files: seven transform requests, five failed-transform diagnostics, then the switched-off diagnostic. Two entries of one package, four failing files each: eight failed-transform diagnostics, none switched off. One entry claiming both extensions, the same eight files: five, then switched off. So the budget of five counts per tsconfig entry, not per package or process.

## The starting point: the loader template

The sources in `src/` started from the loader template in [lab/universal](./lab/universal) (the maintainer's decision: the template stays a template, not a published package), whose contract and adapters are `src/universal.ts` and whose JSON-RPC server is `src/rpc.ts`, unchanged. Changes from the template:

- **Two functions instead of one `load`:** `load` (synchronous JavaScript for the preload and bundlers, since Node's `registerHooks` is synchronous) and `types` (TypeScript for the checker, which may be asynchronous, since only the mapper calls it and json-schema-to-typescript is asynchronous).
- **A RegExp `filter` instead of `extensions` and `test`:** the loaders match `.env` files by name, which an extension list cannot express; Bun and esbuild take a RegExp, and the pattern avoids lookaround for esbuild's RE2.
- **UTF-8 diagnostic positions** and **option diagnostics** in the mapper adapter.
- **Imports with a query are left to the next hook,** above.
- **Problems instead of a thrown error inside `load`,** so one type serves both texts.

## What runs where

| Host | State |
| --- | --- |
| TypeScript 7.1 content mapper (`tsc --runExternalCode`, the editor through the TypeScript 7 extension) | Built and tested: `lab/basic` type-checks with exact-type assertions; the editor was not run |
| Node preload, `node --import motherload/register` | Built and tested |
| nub, `nub --import motherload/register` | Run by hand on `lab/basic` (exit 0, the same output). nub's built-in data loaders export the parsed value as the default (nub's documentation), so `literal` and `raw` need Motherload's preload, whose hook runs before nub's (the template's finding, docs/universal-plugin.md section 3) |
| esbuild, `motherload/esbuild` | Built and tested: a bundle with no `node_modules` input |
| Bun (`bun --preload`, `Bun.build`) | The template's Bun branch is kept in `src/register.ts`; not run, because this repository's tooling rule runs nub in place of bun |
| Vite, Rollup, webpack, Rspack, Turbopack | Not built. The template's unplugin and webpack-loader adapters are the route ([PLAN.md](./PLAN.md#steps)) |
