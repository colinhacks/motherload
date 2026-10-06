# Motherload: design record

Each section is one decision: what was decided, the alternatives weighed, and the evidence. Decisions taken on 2026-10-03 while building the first working version, under the maintainer's instruction to decide and record rather than ask; the maintainer iterates on them from here. What could not be settled is in [PLAN.md](./PLAN.md#open). Measurements were taken on macOS with Node v26.10.0 and nub v0.9.5; "measured" means a command in this repository or in a scratch directory was run and its output read.

## The module an import returns

The maintainer's decisions of 2026-10-06: the default export is typed as `as const` types it, the file's text is a `?raw` import, and a `.env` file is imported for its effect.

```ts
import config from "./app.toml";        // the data: { readonly port: 8080; readonly name: "demo" }
import text from "./app.toml?raw";      // the file's text: string
import "./.env";                        // process.env.PORT: string, loaded when the module runs
```

- **The default export is typed as `as const` would type it** (the maintainer's choice, replacing the first version's widened default and its `literal` export). A readonly array or tuple is not assignable to a mutable one: `const tags: string[] = config.tags` fails with `TS4104: The type 'readonly ["a", "b"]' is 'readonly' and cannot be assigned to the mutable type 'string[]'` (measured on `lab/basic`, which keeps that line under `@ts-expect-error`). Plain `.json`, which stays TypeScript's, is still widened by `resolveJsonModule`.
- **`?raw` is the file's text,** the meaning of Vite's `?raw`, typed by ambient declarations in `src/client.d.ts` (`declare module "*.toml?raw"` and one per extension) that a project lists in tsconfig's `types` as `motherload/client`. TypeScript resolves no query to a file (below), so the mapper never sees these imports; the ambient declaration answers instead, which works because the type of a file's text does not depend on the file. The preload's hook and the esbuild plugin serve `?raw` (esbuild's `text` loader); any other query or hash goes to the next hook or plugin. Patterns per extension, not `*?raw`, so a project that also loads `vite/client` declares no module twice.
- **No top-level keys as named exports.** Node's JSON modules export only `default`, and a key such as `my-key` would not be an identifier.
- **A `.env` import loads the file into `process.env`;** see "The `.env` module" below.

## How an import chooses

The maintainer's idea was a query on the specifier, as in Vite (`./app.toml?raw`, `?const`). Measured with a probe mapper that reports what it receives, on TypeScript `7.1.0-dev.20260918.1` and `7.1.0-dev.20261002.1`:

| Mechanism | TypeScript | What the mapper sees |
| --- | --- | --- |
| Query, `import x from "./y.toml?raw"` | `TS2307: Cannot find module './y.toml?raw'` on both builds | Nothing; no transform |
| Hash, `"./y.toml#raw"` | `TS2307` on both builds | Nothing |
| Import attributes, `with { type: "text" }` or `with { as: "const" }` | Accepted, exit 0 | The transform request carries `fileName`, `content` and `projectHandle` only, so the attribute cannot change the module; one module per file |
| Ambient wildcard, `declare module "*?raw" { const text: string; export default text }` | Accepted; the import is `string` (an `@ts-expect-error` assigning it to `number` is used) | Nothing; the ambient declaration answers, and it cannot see the file, so it cannot type `?const` |
| Named exports (`literal`, `raw`), the first version | Typed per file by the mapper | Everything; the mapper writes all three |

At run time a query does reach the loaders: Node's module hooks resolve `./config.toml?raw` and the template's load hook loaded it (exit 0), and esbuild resolved it to `config.toml`, keeping `?raw` apart in its `suffix`. So a query works everywhere except in the type check, and a design TypeScript cannot type was not shipped.

- **Decided on 2026-10-03: the import chooses by export name** (`literal`, `raw`), the one mechanism the type check, the preload and every bundler agreed on.
- **Revised on 2026-10-06:** with the default typed as `as const`, the one other form left is the text, whose type is `string` whatever the file holds, so an ambient wildcard can type it: `?raw` replaces the `raw` export. A query whose type depends on the file (`?const`, a widened view) still cannot be typed, because the mapper never receives it.
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

## The `.env` module

The maintainer's decision of 2026-10-06: a `.env` file is imported for its effect, `import "./.env"`, which sets its variables on `process.env` and types them there; no value is baked into a module or a bundle.

- **Types:** the module declares each key on `NodeJS.ProcessEnv` in a `declare global` block, typed `string`. A side-effect import puts the module in the program, so the declaration applies to the whole project: measured on `lab/basic`, `process.env.GREETING` is `string` with the import and `string | undefined` without it.
- **Run time:** the module calls `process.loadEnvFile`, Node's own reader, so the type check and the run read one grammar: the keys come from `util.parseEnv`, which replaced dotenv (dotenv 18.0.5 and `util.parseEnv` gave the same values on sixteen lines covering plain, quoted, `export`, comments and multi-line values, measured on 2026-10-03). A variable the environment already sets keeps its value (measured: `PORT=9999` in the environment stayed `9999` after loading a file with `PORT=3000`).
- **Which file:** under the preload the module's own URL is the file. In a bundle the module is inlined, so it reads the file's path relative to the working directory at build time, from the working directory when it runs; a missing file (`ENOENT`) loads nothing, as a deploy that sets its variables another way has none. `tests/lab.test.ts` checks that the esbuild bundle of `lab/basic` holds no value from its `.env` and prints one when run beside it.
- **No expansion:** `${A}` stays the text `${A}`, as `process.loadEnvFile` leaves it. nub expands `${VAR}` when it loads `.env` (nub's documentation); whether Motherload should is in [PLAN.md](./PLAN.md#open).
- **File names:** a `.env` entry in tsconfig matches a file named `.env` (measured: TypeScript transformed `./.env` for a probe mapper claiming `.env`) and, by the suffix rule, `prod.env`. `.env.local` ends in `.local`, which no `.env` entry reaches; the loaders recognise `.env.*` names if an entry claims their suffix.

## The CSV and TSV parser: csv-parse

| Candidate | Latest release | Weekly downloads | Spec | Synchronous | Notes |
| --- | --- | --- | --- | --- | --- |
| csv-parse | 7.0.3, 2026-09-25 | 25.1 M | No RFC claim in its README ("Support delimiters, quotes, escape characters and comments"); strict: a quote inside an unquoted field, or text after a closing quote, is an error (measured) | Yes, `csv-parse/sync` | No dependencies, 1.61 MB (CommonJS, ES module, IIFE and UMD builds), ships its types. An error carries a code, `lines` and a byte count; `on_record` gives each row's end in UTF-8 bytes; `quote: false` turns quoting off; `record_delimiter` takes a list |
| papaparse | 5.7.0, 2026-08-24 | 19.9 M | "reliable and correct according to RFC 4180" (its README); lenient: `1,x"y` is the field `x"y`, with no error (measured) | Yes, `Papa.parse(text)` | No dependencies, 0.27 MB, types in @types/papaparse. An error carries a UTF-16 `index`. It detects one line break per file, so a CRLF file with an LF inside a quoted field fails (measured); its quoting cannot be turned off; it guesses the delimiter unless told |
| d3-dsv | 3.0.1, 2021-06-05 | 27.2 M | "based on RFC 4180" (its README) | Yes, `csvParseRows` | Depends on commander, iconv-lite and rw (its command-line tools); reports no error: an unclosed quote makes the rest of the file one field (measured); no release since 2021 |
| csv-string | 4.1.1, 2022-10-03 | 0.14 M | No claim | Yes, `parse` | No dependencies; an unclosed quote drops every row after the header, with no error (measured on `a,b\n1,2\n"x,y\n3,4\n`) |
| @fast-csv/parse | 5.0.8, 2026-10-05 | 22.8 M | No claim in its README | No: `parse`, `parseString`, `parseFile` and `parseStream` all return a stream (its declarations) | |
| csv-parser | 3.2.1, 2026-05-07 | 3.8 M | "compatibility with the csv-spectrum CSV acid test suite" (its README) | No: a stream | |

Releases and sizes from the npm registry, weekly downloads from its downloads API, on 2026-10-06; each "measured" ran the candidate in a scratch directory. The preload's hook is synchronous, so the two stream parsers are out. Of the four left, csv-parse is the one that refuses every malformed quote (papaparse accepts a quote inside an unquoted field), serves TSV too (`quote: false`), takes CRLF and LF mixed in one file (`record_delimiter: ["\r\n", "\n"]`), ships its types, and is the most downloaded of the maintained ones. Its cost is size: 1.61 MB, against papaparse's 0.27 MB. Writing a parser was not needed.

- **Positions:** each row's end comes from `on_record` in UTF-8 bytes, converted to UTF-16 with a running count, so a problem is placed at its row. An error csv-parse throws is placed at the start of the row that failed (where the last good row ended), not at its own `bytes` or `lines`: measured, `bytes` was sometimes the row's start and sometimes inside it, and an unclosed quote's `lines` names the last line of the file. The message drops csv-parse's "at line N", which the diagnostic's place replaces.

## The `.csv` and `.tsv` module

Decided on 2026-10-06, with the four formats below:

```ts
import users from "./users.csv";   // readonly { readonly name: string; readonly email: string; readonly zip: string }[]
```

- **The first row is the header; each later row is an object keyed by it,** and the default export is the array of rows.
- **Every value is a string.** CSV has no types, and guessing numbers corrupts values such as the zip code `02134` (`lab/basic/users.csv` keeps its zero).
- **The type is the column set, not each cell's literal:** a file of thousands of rows would otherwise be thousands of literal types in the checker and in every hover. A column name is a bare property name when it is an identifier and quoted otherwise, as `propertyName` writes one.
- **A file with only a header** is `[]`, typed as its columns' array. **A file with no header** (empty, or only blank lines) is `[]` typed `readonly never[]`: it has no columns, and `never` says no row exists, where `readonly {}[]` would claim rows with no keys.
- **A blank line is not a row,** wherever it is, as Python's `csv.DictReader` skips blank rows (measured: `a,b\n1,2\n\n3,4\n\n` gave two rows). So in a file of one column a blank line is not an empty value; a line holding `""` is.
- **Problems:** a row whose field count differs from the header's is a problem at that row, every such row reported; an empty or repeated column name is a problem at the header; a quoting error is a problem at its row.
- **CSV follows RFC 4180:** quoted fields, doubled quotes, line breaks inside quotes, and spaces kept as part of a field ("Spaces are considered part of a field and should not be ignored", RFC 4180 section 2). Beyond it: LF as well as CRLF, both in one file, and a byte order mark skipped.
- **TSV follows the IANA text/tab-separated-values registration:** a tab between fields and no quoting, so `"` is an ordinary character and `"hi" she said` stays as written. The registration defines no quoting and no escapes: "Each record is represented as a single line", and "fields that contain tabs are not allowable in this encoding". csv-parse, papaparse and d3-dsv all apply CSV quoting to TSV by default (measured with csv-parse: `"x` opening a TSV field was "Quote Not Closed"), which misreads a field that starts with a quote, so Motherload turns it off. The backslash escapes of PostgreSQL's text format (`\t`, `\n`) stay text. Whether spreadsheet exports need CSV quoting in TSV is in [PLAN.md](./PLAN.md#open).

## The `.txt` and `.md` modules

```ts
import notes from "./notes.txt";                  // string
import post, { frontmatter } from "./post.md";    // string, and { readonly title: "Hello" }
```

- **A `.txt` file is its text,** exactly as `?raw` gives it, typed `string`: a literal type would put the whole file into every hover.
- **A `.md` file's default export is its body without the frontmatter,** typed `string`. Motherload does not render Markdown: no Markdown parser is a dependency, and the body goes to whichever renderer the project uses. `?raw` is the whole file.
- **`frontmatter` is a named export,** one fixed name, so it is an identifier whatever the file holds (the rule against top-level keys as named exports, above, is about names that come from the file).
- **The frontmatter is a `---` line at the very start of the file, closed by the next `---` line;** trailing spaces on either line, CRLF, and a byte order mark before it are accepted. The body starts after the closing line. A `---` line anywhere else is body (a thematic break).
- **It is read as a `.yaml` file is** (the same function: YAML 1.2's core schema, merge keys, a duplicate key an error) and typed as `as const` would type it. A YAML error is placed at its place in the file, offset by where the frontmatter starts, and yaml's "at line N, column M", which counts from the frontmatter, is dropped from the message.
- **No frontmatter, or an empty one, is `{}`,** typed `{}`.
- **A frontmatter that is not a mapping** (a list or a scalar) is a problem at the frontmatter: frontmatter is keys and values by convention, and `null` or a list would make every `frontmatter.title` an error.
- **An opening `---` with no closing line is a problem at the opening line,** not a file that is all body: read as body, a forgotten closing line would hide the YAML in the text with no error. A file that starts with a thematic break and has no other `---` line gets the problem; a blank line before the break avoids it.

## The schema loader: types

A `.schema.json` file becomes the type the schema describes plus a validator (the maintainer's decision). The types come from json-schema-to-typescript 16.0.0 (2026-08-28, 5.1 M weekly downloads), which compiles a schema to TypeScript declarations; json-schema-to-ts (type-level inference from a schema literal, 47 M weekly downloads, last release 2024-08-29) was the alternative, and it needs the schema as a literal type in user code and a library at type-check time. Writing a small emitter was the other alternative; it would cover fewer keywords and be Motherload's to maintain.

- **An optional peer dependency, not a dependency.** Measured from the npm registry's unpacked sizes: the five parsers (smol-toml, yaml, json5, jsonc-parser and csv-parse, on 2026-10-06) total 2.88 MB, and json-schema-to-typescript with its dependencies (prettier 9.96 MB, lodash, two js-yaml majors, @apidevtools/json-schema-ref-parser) 15.9 MB, 85 percent of the 18.8 MB Motherload would otherwise install. Only `.schema.json` imports need it, and they need ajv too, so both are installed together. Without it the schema's types are `any` and a diagnostic says what to install.
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
- **`?raw` is served and other queries are left to the next hook,** above.
- **Problems instead of a thrown error inside `load`,** so one type serves both texts.

## What runs where

| Host | State |
| --- | --- |
| TypeScript 7.1 content mapper (`tsc --runExternalCode`, the editor through the TypeScript 7 extension) | Built and tested: `lab/basic` type-checks with exact-type assertions; the editor was not run |
| Node preload, `node --import motherload/register` | Built and tested |
| nub, `nub --import motherload/register` | Run by hand on `lab/basic` (exit 0, the same output). nub's built-in data loaders export the parsed value as the default (nub's documentation), so `literal` and `raw` need Motherload's preload, whose hook runs before nub's (the template's finding, docs/universal-plugin.md section 3) |
| esbuild, `motherload/esbuild` | Built and tested: a bundle with no `node_modules` input. The default export is a function, `plugins: [motherload()]`, as the maintainer decided on 2026-10-06 for every plugin registered in code |
| Bun (`bun --preload`, `Bun.build`) | The template's Bun branch is kept in `src/register.ts`; not run, because this repository's tooling rule runs nub in place of bun |
| Vite, Rollup, webpack, Rspack, Turbopack | Not built. The template's unplugin and webpack-loader adapters are the route ([PLAN.md](./PLAN.md#steps)) |
| Jest | Not built. A preload does not reach Jest's test code: measured with jest 30.5.2 under `node --import motherload/register`, the preload ran in Jest's process and its workers, but a test's `require("./config.toml")` was read and compiled by jest-runtime itself (`ReferenceError: server is not defined` for a file starting `[server]`), while plain Node under the same preload loaded it. Jest needs a transformer, as dotsql has |
