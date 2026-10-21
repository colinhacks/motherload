# Motherload: design record

Each section is one decision: what was decided, the alternatives weighed, and the evidence. Decisions taken on 2026-10-03 while building the first working version, under the maintainer's instruction to decide and record rather than ask; the maintainer iterates on them from here. What could not be settled is in [PLAN.md](./PLAN.md#open). Measurements were taken on macOS with Node v26.10.0 and nub v0.9.5; "measured" means a command in this repository or in a scratch directory was run and its output read.

## The module an import returns

The maintainer's decisions of 2026-10-06: the default export is typed as `as const` types it, the file's text is a `?raw` import, and a `.env` file is imported for its effect. On 2026-10-20 the maintainer removed `?raw`.

```ts
import config from "./app.toml";        // the data: { readonly port: 8080; readonly name: "demo" }
import "./.env";                        // process.env.PORT: string, loaded when the module runs
```

- **The default export is typed as `as const` would type it** (the maintainer's choice, replacing the first version's widened default and its `literal` export). A readonly array or tuple is not assignable to a mutable one: `const tags: string[] = config.tags` fails with `TS4104: The type 'readonly ["a", "b"]' is 'readonly' and cannot be assigned to the mutable type 'string[]'` (measured on `lab/basic`, which keeps that line under `@ts-expect-error`). Plain `.json`, which stays TypeScript's, is still widened by `resolveJsonModule`.
- **No `?raw`,** removed by the maintainer on 2026-10-20: "I'm not sure this is worth including right now. We shouldn't document it. And we should probably just remove it. We'll see if anyone asks about it later." From 2026-10-06 it gave the file's text, the meaning of Vite's `?raw`, served by the preload's hook and the esbuild plugin (esbuild's `text` loader) and typed by ambient declarations, `declare module "*.toml?raw"` and one per extension, in a `client.d.ts` that a project listed in tsconfig's `types` as `motherload/client`. TypeScript resolves no query to a file (below), so the mapper never saw these imports, and every project carried a `types` entry for them. Measured that day on 7.1.0-dev.20261002.1 before it went: a mapper that starts each module it writes with a `/// <reference path>` to its own `client.d.ts` typed `?raw` with no `types` entry, except for a file imported only with `?raw` and outside `include`, which no mapped module brings into the program (`TS2307`); `/// <reference types="motherload/client" />` in its place failed with `TS2688` in a data file outside the project's `node_modules`. A query or hash on a data file's import now goes to the next hook or plugin.
- **No top-level keys as named exports.** Node's JSON modules export only `default`, and a key such as `my-key` would not be an identifier.
- **A `.md` file's default export is the object `{ md, frontmatter }`,** its body and its frontmatter, each also a named export ([below](#the-txt-and-md-modules)).
- **A `.env` import loads the file into `process.env`;** see "The `.env` module" below.
- **Every module is an ES module,** whatever the nearest package.json says, the maintainer's preference of 2026-10-20: "I definitely have a strong preference for going ESM first here." The mapper reports its module as `.mts`. TypeScript takes a mapped file's format from the extension the mapper reports and the nearest package.json's `type`, as it does a real file's (`GetImpliedNodeFormatForFile` on the virtual file name, in typescript-go's `internal/compiler/filesparser.go`, read on main on 2026-10-20), and the transform's answer has no other field for it (`MappedOutput`: `text`, `extension`, `mappings`, `diagnosticDirectives`). With `.ts`, a data file in a package with no `type` was typed as CommonJS, so an ES module's default import of it was the whole module and `config.port` was `TS2339`, though the preload and the plugins load the file as an ES module. Measured on 7.1.0-dev.20261002.1 with a data file in a package with no `type`: an `.mts` importer under `nodenext` failed with `.ts` and passes with `.mts`; a CommonJS `.ts` or `.cts` importer passes either way under `nodenext` and `node20`, which let CommonJS `require` an ES module, as the Node 24 Motherload needs does; under `node16` and `node18`, which model a Node that cannot, a CommonJS importer gets `TS1479` with `.mts`; `preserve`, and `esnext` with bundler resolution, pass either way; declaration emit names the file `config.d.toml.ts` either way. The other way out, `"type": "module"` in the nearest package.json, is the project's to write. The fixture `tests/fixtures/commonjs` checks it.

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
- **Revised on 2026-10-20:** `?raw` is gone (above), so an import has one form, the default export. Read again that day on typescript-go's main branch, where `internal/contentmapper/hostimpl.go` last changed on 2026-08-19: the transform request, `TransformParams`, holds `fileName`, `content` and `projectHandle`, and the module resolver (`internal/module/resolver.go`) has no handling for a query, so a mapper transforms each file once and cannot type an import by its query.
- **Rejected: an option per tsconfig entry** (`options: { literal: true }`, or a second entry for a suffix such as `.const.toml`). Both choose per file or per suffix, not per import, and the second makes users rename files.

## The TOML parser: smol-toml

| Candidate | Latest release | Weekly downloads | Spec | Notes |
| --- | --- | --- | --- | --- |
| smol-toml | 1.9.0, 2026-09-22 | 45.4 M | TOML 1.1.0; "passing all tests from the official toml-test suite" (its README; the footnote: some invalid datetimes are accepted, and full type preservation needs `integersAsBigInt`) | No dependencies, 0.14 MB |
| toml | 5.0.0, 2026-07-14 | 32.4 M | TOML 1.1.0, 702 of 708 toml-test cases (its README) | No dependencies |
| @iarna/toml | 2.2.5, 2020-04-22 | 9.8 M | TOML 1.0.0-rc.1 (its README) | Unmaintained since 2020 |
| @ltd/j-toml | 1.38.0, 2023-01-16 | 0.28 M | | LGPL-3.0 |

Downloads and releases from the npm registry and downloads API on 2026-10-03. The smol-toml parser passes the whole suite, is the most used, and is maintained. Options: `integersAsBigInt: "asNeeded"`, so an integer past 2^53 is a `bigint` (typed `bigint`) instead of a rounded number, and the default `TomlDate`, whose `.isLocal()` tells the four TOML date kinds apart. A parse error carries `line` and `column`, which become the diagnostic's place.

## TOML dates

- **An offset date-time is a `Date`** (`new Date(...)` in the module, `Date` in both types): it names an instant.
- **A local date-time, local date or local time is its ISO text** (`"1979-05-27"`, `"1979-05-27T07:32:00.000"`, `"07:32:00.000"`), typed as that text, `"1979-05-27"`, as any string is (`lab/basic/main.ts`): none names an instant, and a `Date` would invent a time zone. The text is smol-toml's `.toISOString()`, which adds milliseconds to a time (`tests/formats.test.ts`).
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
- **Several documents (`---`) are the list of their values,** in order, typed as a readonly tuple of them; one document is its value; a file with no document is `null`. Refusing a multi-document file was the alternative; it would make a whole class of files unimportable. A single document whose value is a list reads the same as several documents; a `documents` export would tell them apart, and the maintainer kept the one shape on 2026-10-06, because each import is typed exactly from its file, so its author sees the shape it has.
- A YAML value no module can carry (`!!binary`, `!!set`, a Map with object keys under YAML 1.1) is a diagnostic naming its path.

## The JSON5 parser: json5

The json5 package, 2.2.3 (2022-12-31, 284 M weekly downloads, no dependencies), is published by the JSON5 project itself (github.com/json5/json5); no other JSON5 parser was found worth weighing. Its `SyntaxError` carries `lineNumber` and `columnNumber`. It keeps a `__proto__` key as a property (measured).

## The JSONC parser: jsonc-parser

| Candidate | Latest release | Weekly downloads | Notes |
| --- | --- | --- | --- |
| jsonc-parser (Microsoft) | 3.3.1, 2024-06-24 | 85 M | A scanner and fault-tolerant parser for JSON with comments (its README); errors with offset and length |
| strip-json-comments | 5.0.3, 2025-08-08 | 259 M | Removes comments for `JSON.parse`; no positions of its own |
| comment-json | 5.0.0, 2026-04-12 | 20 M | Keeps comments for round-trips; depends on esprima |

The jsonc-parser package is the only candidate that parses JSONC itself and places its errors. Trailing commas are allowed (`allowTrailingComma: true`), since a hand-edited `.jsonc` file collects them; whether to refuse them is in [PLAN.md](./PLAN.md#open). The value is built from `parseTree`, not from the library's `parse`: `parse` assigns keys, and a `"__proto__"` key then sets the prototype instead of becoming a property (measured: `parse('{"__proto__": 1, ...}')` lost the key).

## The `.env` module

The maintainer's decision of 2026-10-06: a `.env` file is imported for its effect, `import "./.env"`, which sets its variables on `process.env` and types them there; no value is baked into a module or a bundle.

- **Types:** the module declares each key on `NodeJS.ProcessEnv` in a `declare global` block, typed `string`. A side-effect import puts the module in the program, so the declaration applies to the whole project: measured on `lab/basic`, `process.env.GREETING` is `string` with the import and `string | undefined` without it.
- **Run time:** the module calls `process.loadEnvFile`, Node's own reader, so the type check and the run read one grammar: the keys come from `util.parseEnv`, which replaced dotenv (dotenv 18.0.5 and `util.parseEnv` gave the same values on sixteen lines covering plain, quoted, `export`, comments and multi-line values, measured on 2026-10-03). A variable the environment already sets keeps its value (measured: `PORT=9999` in the environment stayed `9999` after loading a file with `PORT=3000`).
- **Which file:** under the preload the module's own URL is the file. In a bundle the module is inlined, so it reads the file's path relative to the working directory at build time, from the working directory when it runs; a missing file (`ENOENT`) loads nothing, as a deploy that sets its variables another way has none. A test in `tests/lab.test.ts` checks that the esbuild bundle of `lab/basic` holds no value from its `.env` and prints one when run beside it.
- **No expansion:** `${A}` stays the text `${A}`, as `process.loadEnvFile` leaves it. nub expands `${VAR}` when it loads `.env` (nub's documentation); whether Motherload should is in [PLAN.md](./PLAN.md#open).
- **File names:** a `.env` entry in tsconfig matches a file named `.env` (measured: TypeScript transformed `./.env` for a probe mapper claiming `.env`) and, by the suffix rule, `prod.env`. A file named `.env.local` ends in `.local`, which no `.env` entry reaches; the loaders recognise `.env.*` names if an entry claims their suffix.

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
import post from "./post.md";                     // { readonly md: string; readonly frontmatter: { readonly title: "Hello" } }
import { md, frontmatter } from "./post.md";      // each part, as a named export
```

- **A `.txt` file is its text,** typed `string`: a literal type would put the whole file into every hover.
- **A `.md` file's default export is the object `{ md, frontmatter }`,** the maintainer's decision of 2026-10-20: `md` is the body without the frontmatter, typed `string`, and `frontmatter` the frontmatter. It replaced, the same day, a module of the two named exports with no default, which had replaced the first version's default export of the body as a string.
- **The default is there for its hover.** A default import hovers with its whole type, `(alias) const post: { readonly md: string; readonly frontmatter: { … } }`, while TypeScript hovers every namespace import as its name alone: `import * as post from "./post.md"` shows `import post`, as a namespace import of a `.ts` file does (measured with TypeScript 6.0.3's language service, which draws the docs site's hovers). Typing the module as one object with `export =` would give the namespace import that hover, but through the mapper it is `TS1203: Export assignment cannot be used when targeting ECMAScript modules` in the `.md` file, under `nodenext` and under bundler resolution, with or without `skipLibCheck` (measured on 7.1.0-dev.20261002.1).
- **The default's type spells the frontmatter out again,** not as `typeof frontmatter`, which the hover would print as written (measured: `{ readonly md: typeof md; readonly frontmatter: typeof frontmatter }`).
- **The `md` and `frontmatter` parts are also named exports,** so a bundle that imports only `frontmatter` leaves the body out. Measured with esbuild, minified: the body's text was absent from the bundle of `import { frontmatter }` and present in the bundle of the default import.
- **Motherload does not render Markdown:** no Markdown parser is a dependency, and `md` goes to whichever renderer the project uses. Exporting the body rendered as HTML, or as an AST, was left for later by the maintainer ([PLAN.md](./PLAN.md#open)).
- **An `html` export, or an AST, would be made when the module is built, with no renderer in a bundle,** as the two plugins that offer one do (read in their sources on 2026-10-20): Astro's Markdown transform renders the body and writes the HTML into the module as a string, which `compiledContent()` returns, with `getHeadings()` returning a list written in the same way; vite-plugin-markdown renders with markdown-it and exports `html` as a `const`. A bundle that does not import a named export leaves it out, as it leaves out `md` (above), so in a bundle that is the laziness an unused export gets. Rendering when the module runs, on first access, would put a renderer in the module, where every Motherload module today imports nothing. The preload runs the loader in the program's own process, so there each `.md` file would be rendered when it is first imported, used or not. Measured with micromark 4.0.2 and its GFM extension on Node 26.11.1: loading micromark, the extension and mdast-util-from-markdown took 67 ms; rendering took 3 ms for this repository's README (7 KB), 8 ms for the docs page (18 KB) and 26 ms for this file (64 KB); the HTML was about 1.3 times the text, and an mdast as JSON 5 to 7 times the text with positions and about 2 times without.
- **The names `md` and `frontmatter` are fixed,** so each is an identifier whatever the file holds (the rule against top-level keys as named exports, above, is about names that come from the file).
- **The frontmatter is a `---` line at the very start of the file, closed by the next `---` line;** trailing spaces on either line, CRLF, and a byte order mark before it are accepted. The body starts after the closing line. A `---` line anywhere else is body (a thematic break).
- **It is read as a `.yaml` file is** (the same function: YAML 1.2's core schema, merge keys, a duplicate key an error) and typed as `as const` would type it. A YAML error is placed at its place in the file, offset by where the frontmatter starts, and yaml's "at line N, column M", which counts from the frontmatter, is dropped from the message.
- **No frontmatter, or an empty one, is `{}`,** typed `{}`; a file with no frontmatter is all `md`.
- **A file whose frontmatter fails to parse** is typed `md: string` and `frontmatter: any`, and its default `{ readonly md: string; readonly frontmatter: any }`, so the problem is the one error and no use of the module adds another; `md` keeps `string` because the body's type does not depend on the file.
- **A frontmatter that is not a mapping** (a list or a scalar) is a problem at the frontmatter: frontmatter is keys and values by convention, and `null` or a list would make every `frontmatter.title` an error.
- **An opening `---` with no closing line is a problem at the opening line,** not a file that is all body: read as body, a forgotten closing line would hide the YAML in the text with no error. A file that starts with a thematic break and has no other `---` line gets the problem; a blank line before the break avoids it.

## JSON Schema left for dotschema

The maintainer's decision of 2026-10-21: "I'm trying to decide whether to extract the JSON schema into its own package, something like `dotschema`. I think it's cleaner to extract it personally. It's not really the same as the data loading that we do in the other stuff. Let's go ahead and do it." Then: "The new package doesn't need a documentation site. It can just have a README." And: "We could always add support into Motherload later and give Motherload a dependency on dotschema, but not right now." It supersedes the Packaging note of earlier that day, "Keep it in `motherload`", the maintainer's answer when asked whether to take schemas out before 0.0.1 was published.

- **What left:** `@motherload/schema`, the `.schema.jsonc` and `.schema.json5` loader (its type emitter, its `$ref`s into other files, its two ajv validators behind `.validate()` and `.is()`, and Standard JSON Schema), with its four test files, its fixtures and its part of `lab/basic`, `lab/packages`, the README and the docs page. The five sections that recorded it here, "The schema loader: types", "references to other files", "the suffix", "the validator" and "Standard JSON Schema", moved to dotschema's DESIGN.md as they stood at d21b5ac, with the schema's rows and notes of Packaging.
- **Motherload has no dependency on dotschema, and none on ajv:** the `motherload` package is the eight data formats, and it has no `.` export, since the schema types were all that export held. With no loader claiming the longer suffix, a `.schema.jsonc` or `.schema.json5` file is JSONC or JSON5 data, as any other `.jsonc` or `.json5` file is (`tests/formats.test.ts`). The docs page and the README point a JSON Schema import at dotschema in one sentence, as the page points a `.sql` import at Reylo. The diagnostic code 4, the schema's, is not reused.
- **The deference protocol is shared with dotschema:** of the loaders in one host, the one claiming a file's longer suffix loads it ([Packaging](#packaging)), and loaders find each other through two global keys in `packages/core/src/universal.ts`, `Symbol.for("motherload.registered")`, the process-wide set that Node's and Bun's preloads register into, and `Symbol.for("motherload.plugin")`, the loader an esbuild plugin object carries. dotschema joins through the same keys, so `motherload` or `@motherload/jsonc` for `.jsonc` beside dotschema for `.schema.jsonc` loads each file with its own loader under Node's hooks, Bun and esbuild, in whatever order the host was given them. The keys stay as they are. Tests in `tests/packages.test.ts` check it in both orders in each host with a stand-in loader for both schema suffixes, written with nothing from `@motherload/core`.
- **Breaking for the next release:** the published `motherload@0.0.1` and `@motherload/schema@0.0.1`, both of 2026-10-21 (release run 39560615518, [Releasing](#releasing)), read schemas, and the next `motherload` does not; no later release publishes `@motherload/schema` ([PLAN.md](./PLAN.md#open)).

## Values a module carries

The serializer (`packages/core/src/serialize.ts`) writes each parsed value as JavaScript and as the type `as const` would give it; the widened type the first version also wrote went with its widened default on 2026-10-06. Beyond JSON: `NaN`, `Infinity`, `-Infinity` and `-0` (YAML `.inf`, JSON5 `Infinity`, TOML `nan`), `bigint` (`123n`), and `Date`. A `"__proto__"` key is written as a computed key, because `{"__proto__": x}` in an object literal sets the prototype (`tests/serialize.test.ts`). Literal types: `NaN` and the infinities are `number`, as TypeScript has no literal type for them. Anything else (a Map, a Set, bytes, `undefined`) is a diagnostic naming its path.

## Diagnostics

- **Positions are UTF-8 bytes.** The mapper declares `positionEncoding: "utf-8"` in `initialize`, as the template and dotsql's mapper do, and dotsql's mapper places its diagnostics in UTF-8 bytes; the parsers report UTF-16 offsets, so the mapper converts them (`utf8Range`). The template passed UTF-16 offsets through, which places an error after a non-ASCII character too early. Measured: `tests/fixtures/errors/broken.toml`, whose first line holds `é`, reports `broken.toml(2,8)`.
- **Codes** (shown as `motherload<code>`): 1 syntax, 2 a value no module can carry, 3 a file whose suffix Motherload does not read, 5 an option in tsconfig; 4 was the schema's until 2026-10-21 ([above](#json-schema-left-for-dotschema)).
- **A file that does not parse is typed `any`.** The diagnostic in the file fails the type check already; `any` keeps every use of the import from adding errors of its own. The template typed it `never`, and dotsql types a failed analysis `unknown`.

## The mapper process

- **No `dynamicConfig`.** A data file's module depends on the file alone. Without the flag TypeScript computes the transform identity from the package name and version and the tsconfig options without starting the process (the content mapper PR's text, quoted in the porg repository's `docs/prior-art.md` section 4b), and starts it only for a matching file. Measured with probe mappers on both builds: a static mapper with no matching file in the program started no process, with or without `--incremental`, while a `dynamicConfig` mapper started and answered `openProject` on every `--incremental` run, with no matching file present.
- **No options.** A key in a tsconfig entry's `options` is reported (code 5) through `optionDiagnostics`, the field dotsql's mapper uses.
- **One tsconfig entry for every format.** TypeScript starts one process per package and version (measured: two entries of one package, one process, each entry its own `openProject` with its own `options`). The failure budget is per entry (below), so a project that wants one format's failures kept apart from the others' lists that format in an entry of its own.
- **Plain `.json` stays TypeScript's:** a mapper cannot claim it (`TS100021` on `7.1.0-dev.20260918.1`, `TS18066` on `7.1.0-dev.20261002.1`: "a built-in extension and cannot be registered"), and `.schema.json` could be claimed beside it on both builds (measured: the probe mapper transformed `user.schema.json` while `plain.json` was typed by `resolveJsonModule`). From the nightly after 2026-10-13 no suffix that ends in `.json` can be claimed either, which is why a schema became a `.schema.jsonc` or `.schema.json5` file, dotschema's suffixes since 2026-10-21 ([PLAN.md](./PLAN.md#content-mapper-facts)).

## The TypeScript build

The repository pins `typescript@7.1.0-dev.20261002.1`, the newest nightly older than nub's 24-hour minimum release age on 2026-10-03 (`7.1.0-dev.20261003.1` was refused with `ERR_NUB_NO_MATURE_MATCHING_VERSION`). dotsql uses `7.1.0-dev.20260918.1`. Every probe below ran on both, with the same behaviour; the content mapper diagnostic codes were renumbered between them:

| Diagnostic | 20260918.1 | 20261002.1 |
| --- | --- | --- |
| A built-in extension (`.json`) | TS100021 | TS18066 |
| An extension in two mappers | TS100022 | TS18067 |
| Mappers without `--runExternalCode` | TS100024 | TS18068 |
| A failed transform | TS100025 | TS18069 |
| A mapper switched off after five failures | TS100026 | TS18070 |

A later rule is on neither build: from the nightly after 2026-10-13, an extension that ends in a built-in one, such as `.schema.json`, is refused with TS18066 (measured on `7.1.0-dev.20261019.1` and on the released `7.1.0-beta`, [PLAN.md](./PLAN.md#content-mapper-facts)).

Failure budget, measured with a mapper that throws for files named `fail*`: one entry, seven failing files: seven transform requests, five failed-transform diagnostics, then the switched-off diagnostic. Two entries of one package, four failing files each: eight failed-transform diagnostics, none switched off. One entry claiming both extensions, the same eight files: five, then switched off. So the budget of five counts per tsconfig entry, not per package or process.

## The starting point: the loader template

The sources started from the loader template in [lab/universal](./lab/universal) (the maintainer's decision: the template stays a template, not a published package), whose contract and adapters are `packages/core/src/universal.ts` and whose JSON-RPC server is `packages/core/src/rpc.ts`, unchanged. Changes from the template:

- **Two functions instead of one `load`:** `load` (synchronous JavaScript for the preload and bundlers, since Node's `registerHooks` is synchronous) and `types` (TypeScript for the checker, which may be asynchronous, since only the mapper calls it).
- **A RegExp `filter` instead of `extensions` and `test`:** the loaders match `.env` files by name, which an extension list cannot express; Bun and esbuild take a RegExp, and the pattern avoids lookaround for esbuild's RE2.
- **UTF-8 diagnostic positions** and **option diagnostics** in the mapper adapter.
- **An `.mts` module, not `.ts`,** above.
- **A query or hash is left to the next hook,** above.
- **Problems instead of a thrown error inside `load`,** so one type serves both texts.

## What runs where

| Host | State |
| --- | --- |
| TypeScript 7.1 content mapper (`tsc --runExternalCode`, the editor through the TypeScript 7 extension) | Built and tested: `lab/basic` type-checks with exact-type assertions; the editor was not run |
| Node preload, `node --import motherload/register` | Built and tested |
| nub, `nub --import motherload/register` | Run by hand on `lab/basic` (exit 0, the same output). nub's built-in data loaders export the parsed value as the default (nub's documentation), so `literal` and `raw` need Motherload's preload, whose hook runs before nub's (the template's finding, docs/universal-plugin.md section 3) |
| esbuild, `motherload/esbuild` | Built and tested: a bundle with no `node_modules` input. The default export is a function, `plugins: [motherload()]`, as the maintainer decided on 2026-10-06 for every plugin registered in code |
| Bun (`bun --preload`, `Bun.build`) | The template's Bun branch is kept in `register` (`packages/core/src/universal.ts`); not run, because this repository's tooling rule runs nub in place of bun |
| Vite, Rollup, webpack, Rspack, Turbopack | Not built. The template's unplugin and webpack-loader adapters are the route ([PLAN.md](./PLAN.md#steps)) |
| Jest | Not built. A preload does not reach Jest's test code: measured with jest 30.5.2 under `node --import motherload/register`, the preload ran in Jest's process and its workers, but a test's `require("./config.toml")` was read and compiled by jest-runtime itself (`ReferenceError: server is not defined` for a file starting `[server]`), while plain Node under the same preload loaded it. Jest needs a transformer, as dotsql has |

## Packaging

Decided by the maintainer on 2026-10-08 and 2026-10-09: Motherload becomes a family of packages released together at one version. Each format is a package of its own under the `@motherload` scope, complete with its mapper, preload, esbuild plugin and parser; `motherload` is the package of all of them, with one mapper, one preload and one plugin; the code they share is `@motherload/core`, a published dependency of every other package. Built on 2026-10-20, the maintainer's answer that day: "Build them, then document them in Setup" (the docs page's "Loaders à la carte").

| Package | Extensions | Dependencies, each at an exact version |
| --- | --- | --- |
| `@motherload/core` | none: the loader contract and its adapters (Node hooks, Bun, esbuild, the mapper's handlers), the JSON-RPC server, the serializer, the error codes and positions | none |
| `@motherload/toml` | `.toml` | core, smol-toml |
| `@motherload/yaml` | `.yaml`, `.yml` | core, yaml |
| `@motherload/json5` | `.json5` | core, json5 |
| `@motherload/jsonc` | `.jsonc` | core, jsonc-parser |
| `@motherload/env` | `.env` | core (the parser is Node's `util.parseEnv`) |
| `@motherload/csv` | `.csv`, `.tsv` | core, csv-parse |
| `@motherload/txt` | `.txt` | core |
| `@motherload/md` | `.md` | core, `@motherload/yaml`, whose parser reads the frontmatter |
| `motherload` | all of the above | core and the eight format packages |

A format package's manifest as `nub run build` writes it, `@motherload/yaml` here; `./loader` is the format's `LoaderPlugin`, which `motherload` combines with the other seven:

```jsonc
{
  "name": "@motherload/yaml",
  "type": "module",
  "exports": {
    "./loader": { "types": "./src/loader.d.ts", "default": "./src/loader.js" },
    "./register": { "types": "./src/register.d.ts", "default": "./src/register.js" },
    "./esbuild": { "types": "./src/esbuild.d.ts", "default": "./src/esbuild.js" } // export default function yaml()
  },
  "typescript": { "contentMapper": { "exec": ["node", "src/mapper.js"], "compilerOptions": [] } },
  "dependencies": { "@motherload/core": "0.0.0", "yaml": "2.9.1" }
}
```

The `motherload` package's manifest has the same `typescript` field and the `./register` and `./esbuild` exports, over the combined loader, and depends on `@motherload/core` and the eight format packages at the release's version. It has no `.` export ([above](#json-schema-left-for-dotschema)).

| A project's setup | With `motherload` | With `@motherload/yaml` |
| --- | --- | --- |
| tsconfig entry | `{ "package": "motherload", "extensions": [ every extension it uses ] }` | `{ "package": "@motherload/yaml", "extensions": [".yaml", ".yml"] }` |
| Node.js | `--import motherload/register` | `--import @motherload/yaml/register` |
| esbuild | `plugins: [motherload()]` | `plugins: [yaml()]` from `@motherload/yaml/esbuild` |

- **Exact versions throughout,** so the transform identity, which TypeScript computes from the mapper package's name and version and the tsconfig options (the content mapper PR's text, quoted in the porg repository's `docs/prior-art.md` section 4b), changes whenever a parser does. An optional peer's version is outside that identity: an `--incremental` build could keep a module built with an older peer (this follows from the PR's text and was not measured).
- **One owner per extension:** two packages that claim one extension fail the type check (`TS18067`), so a project lists `motherload` or a format package for each extension, never both.
- **One process per package:** TypeScript starts one mapper process per package, so `motherload` serves every format from one process, one tsconfig entry, one `--import` and one plugin; a project of two format packages has two of each.
- **A scoped package is a mapper like any other:** measured on `7.1.0-dev.20261002.1`, a tsconfig entry `{ "package": "@probe/loader" }` started that package's mapper and typed a `.toml` import from it.
- **A project that runs under the preload** loads its Motherload package at run time and lists it in `dependencies`; a bundled project lists it in `devDependencies`, because a generated module imports no package at run time. A format package keeps the first case small: an app that preloads only TOML installs `@motherload/core`, `@motherload/toml` and smol-toml.
- **The repository:** `packages/<name>/` holds each package but `motherload`, which is the repository's root, linked into it with `link:` as Reylo links its engines; the root `package.json` also lists every parser, from which the packages' sources resolve them, so one install at the root serves all of them and the docs site's install (the root, then `site/`) is unchanged. A pnpm workspace was the alternative; the links keep the layout Reylo already uses (`@reylosql/postgres: link:packages/postgres` in its root `package.json`). Each manifest in the repository is private and points at its TypeScript sources, so the tests and the labs run without a build.
- **The build:** `nub run build` (`scripts/build.ts`) compiles every package with tsc (`tsconfig.build.json`) into `dist/<dir>`, one directory per package to publish with `npm publish dist/<dir>`: JavaScript, declarations, a README, and a manifest whose exports and mapper name the compiled files (Node strips no types under `node_modules`), with each Motherload dependency at the release's version and every other at the version installed here. Running `nub run check-dist` (`scripts/check-dist.ts`) packs each into a tarball, installs the tarballs into two projects outside the repository, a copy of `lab/basic` on `motherload` and a copy of `lab/packages` on `@motherload/toml` and `@motherload/jsonc` alone, and type-checks, preloads and bundles each, under nub's isolated layout, where a package reaches only its own dependencies. Until 2026-10-21 it also installed `lab/basic` hoisted beside ajv 6, a check of the schema loader's ajv that left with it.
- **The longest suffix, in every host:** TypeScript gives `user.schema.jsonc` to the entry with the longer suffix, dotschema's over `@motherload/jsonc`'s (`@motherload/schema`'s until 2026-10-21). A host does not: Node runs the hook registered last first, and esbuild runs plugins in their order, so the JSONC package's loader would read a schema as data, its validator gone, for one order of the flags. So each loader names its extensions, and of the loaders in one host that share the protocol, the one claiming the longer suffix of a file loads it: a Node hook passes the file to the next hook, an esbuild plugin returns nothing for it (it sees its siblings in `initialOptions.plugins`, under `Symbol.for("motherload.plugin")`), and a Bun plugin, which may not return nothing (oven-sh/bun#5303), loads it with that sibling. Node's and Bun's registrations are process-wide, kept on `globalThis` under `Symbol.for("motherload.registered")`. Tests in `tests/packages.test.ts` check both orders in each host with a stand-in for dotschema's loader ([above](#json-schema-left-for-dotschema)). A `.env.<name>` file is claimed by name alone, so a format that reads its suffix wins (`.env.toml` is TOML).
- **One diagnostic source:** every package reports as `motherload` (`motherload1` is a syntax error whichever package found it), and a package's message for an extension it does not read names the package: "@motherload/toml reads .toml files; … Remove its extension from @motherload/toml's contentMappers entry."
- **The `@motherload` scope replaces the per-format `dot<ext>` names,** which stay reserved: `dotyaml`, `dotyml`, `dotjson` and `dotmd` are held by other people ([PLAN.md](./PLAN.md#names)).

Sizes, from the npm registry's `dist.unpackedSize` on 2026-10-07:

| Package | Version | Unpacked size | Needed for |
| --- | --- | --- | --- |
| smol-toml | 1.9.0 | 0.14 MB | `.toml` |
| yaml | 2.9.1 | 0.69 MB | `.yaml`, `.yml`, a `.md` file's frontmatter |
| json5 | 2.2.3 | 0.24 MB | `.json5` |
| jsonc-parser | 3.3.1 | 0.21 MB | `.jsonc` |
| csv-parse | 7.0.3 | 1.61 MB | `.csv`, `.tsv` |
| typescript (for comparison) | 7.1.0-dev.20261002.1 | 3.98 MB, plus 28.7 MB for `@typescript/typescript-darwin-arm64` | the compiler every Motherload project already installs |

The parsers cost little to load: before the split, `src/formats.ts` imported all five statically, and importing it took 19 to 47 ms in a fresh Node process (three runs).

The shapes that were considered, on 2026-10-07: one package with the parsers as dependencies (the first version); one package with each parser an optional peer, which saves up to 2.88 MB and moves the parser's version outside the transform identity; and one package per format with no package of all of them, which gives every project a process per format.


## Releasing

Every package is released at one version by `.github/workflows/release.yml`, the maintainer's request of 2026-10-20: "We should try to pull in the release infrastructure from Zod and get the first version published", and "We'll need to set up trusted publishing as well." It is Zod's release (`.github/workflows/release.yml` and `.github/scripts/npm-stage-publish.sh` in colinhacks/zod), for ten packages in place of Zod's two (eleven until the schema package left on 2026-10-21).

- **Dispatch only:** the workflow runs on `gh workflow run release.yml -R colinhacks/motherload` and from `main` alone, never on a push or a tag. A dispatch needs a GitHub session or token with write access, which a stolen push credential is not, the shape of the 2026-09-21 compromise of nubjs/nub, where a pushed tag published 18 packages unattended (Zod's workflow, quoting it). A version bump on `main` publishes nothing by itself.
- **Stage-only trusted publishing:** each package's npm trusted publisher is this workflow in colinhacks/motherload on its `npm` environment, with `--allow-stage-publish` and not `--allow-publish`, so the workflow authenticates with OIDC, holds no npm token, and can only put a version in npm's staged queue, where it is not installable. A version is served once the maintainer approves it with 2FA, with `stager` (`~/Documents/stager`), which approves every staged version under one code and resumes the run.
- **Two GitHub environments:** `npm`, which the staging job runs in, and `release-approval`, a job with no runner that holds the run, for up to 30 days, until the maintainer resumes it; each deploys `main` alone and has the maintainer as its required reviewer, as Zod's have. The npm approval is the gate: the last job waits up to 340 minutes for npm to serve every version, through the automated review npm runs after an approval (16 to 116 minutes for Zod's releases), before it creates the GitHub release `v<version>` at the run's commit, its notes the packages and the commits since the previous tag.
- **What is checked before anything is staged:** `nub run typecheck`, `nub run test`, `nub run build` and `nub run check-dist` in the first job; the staging job builds and runs `check-dist` again, so what it stages is what it checked. The workflow `.github/workflows/test.yml` runs the four on every push to `main`.
- **Left out of Zod's:** the JSR publishes, and the scheduled check that zod and @zod/mini are at the same version, which `scripts/build.ts` and `tests/packages.test.ts` already enforce for Motherload's packages.
- **The order:** `@motherload/core` is staged first and `motherload` last, so the staged queue, which `stager` approves oldest first, reads in dependency order.
- **The version:** `nub run bump <version>` (`scripts/bump.ts`) writes it into every manifest and every dependency between them. The first release is 0.0.1, the maintainer's choice of 2026-10-21 ("you should be staging 0.0.1"), over the 0.1.0 first proposed. The same day 0.1.0 followed ("lets cut 0.1"), ten packages now that JSON Schema has left for dotschema: run 39637448941 staged them, `stager` listed them as one release, and the run created the GitHub release `v0.1.0` at 1e3fad2. Installed from npm into a copy of `lab/basic`, `motherload@0.1.0` type-checks, runs under the preload and bundles with esbuild.
- **The first publish:** npm can configure a trusted publisher only for a package that exists (`npm help trust`, "Package must exist", npm 11.20.0), so the workflow cannot make a package's first publish. On 2026-10-20 npm had `motherload` (`0.0.0`, and a `0.0.0-stage` from 2026-10-03) and the `@motherload` organization with no packages (`https://registry.npmjs.org/-/org/motherload/package` answered `{}`). The script `scripts/npm-first-publish.sh`, run by the maintainer, publishes a `0.0.0` placeholder for each package missing from npm and then configures each trusted publisher, under a browser login of its own that it logs out of when it exits, as nub's `scripts/npm-first-publish-runner.sh` did for nub's runner packages. Its run of 2026-10-21 published the ten `@motherload` placeholders: npm answered each publish with `202` and "Your package is being processed and may take a few minutes to become available", showed a package's one version as `0.0.0-stage`, "Temporary package placeholder for staged publishing", in the meantime, and served `0.0.0` beside it within six minutes, the shape `motherload` has had since 2026-10-03. Its trust commands failed: `npm trust` accepts only its own flags and read `--userconfig <path>` as a stray positional argument, so the login file is passed as `NPM_CONFIG_USERCONFIG` instead, and the first staging run failed with `E401` after npm's token exchange answered "OIDC token exchange error - package not found" (run 39559700934). Run again with that fix, the script configured the eleven trusted publishers, each `npm trust github` answered with `201` and checked by `npm trust list`.
- **The first release, 0.0.1:** run 39560615518 of 2026-10-21 staged all eleven with provenance (each OIDC token exchange and each `npm stage publish` answered `201`), npm's review of the staged versions had finished by 07:25 UTC, eight minutes after the last was staged, and once npm served every version the run created the GitHub release `v0.0.1` at 6837089. The approval took two sittings. The `stager` tool listed `motherload` as a release of its own, apart from "colinhacks/motherload 0.0.1" with the other ten, because it read a package's repository from its latest version, `motherload`'s `0.0.0` of 2026-10-03, which names none, and cached that answer; the Approve button on the daemon's notification for "motherload 0.0.1" approved that package alone, so from 15:53 to 16:03 UTC `motherload@0.0.1` was served while `npm install motherload@0.0.1` failed with `ETARGET` for `@motherload/core@0.0.1`, until a second approval in `stager` took the ten. Installed from npm into a copy of `lab/basic` outside the repository, `motherload@0.0.1` type-checks, runs under the preload and bundles with esbuild.
