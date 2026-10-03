# Loader plugins: one definition for Node, nub, Bun, bundlers and the TypeScript content mapper

> [!NOTE]
> Copied on 2026-10-03 from dotsql (`~/Documents/projects/dotsql/docs/universal-plugin.md` at `e880388`), which had it from the porg repository (`~/Documents/projects/lando`, commit `bb06418` there, `478942c` in dotsql), together with the prototype it describes, now [lab/universal](../lab/universal). The text is unchanged but for this note and the references below that named the porg repository's own files, which now name them where they live. Two things differ here: the prototype's packages `universal-toml` and `universal-toml-2` are linked into the repository's root `node_modules` by `package.json` (`link:lab/universal/plugin`) instead of the symlinks section 6 lists, and the transcript was taken on TypeScript `7.1.0-dev.20260918.1`; on `7.1.0-dev.20261002.1`, which this repository uses, the type checks of sections 7.1 and 7.3 give the same results, but the content mapper diagnostics are renumbered (`TS100022` is `TS18067`, `TS100024` is `TS18068`, `TS100025` is `TS18069`, `TS100026` is `TS18070`; see [DESIGN.md](../DESIGN.md#the-typescript-build)).

Date: 2026-09-18. Prototype: [`lab/universal`](../lab/universal) (Node v26.7.0, nub v0.8.3, Bun 1.3.14, esbuild 0.28.2, unplugin 3.4.0, typescript 7.1.0-dev.20260918.1). Content mapper sources read at microsoft/TypeScript `4ba2fafe` (2026-09-18) under `tsc/internal/`.

A loader plugin is one object that says which files it owns and how a file becomes a module. Five adapters, each under forty lines, project that object onto Node's `module.registerHooks`, nub, `Bun.plugin`, esbuild, unplugin (Vite, Rollup, Rolldown, webpack, Rspack, Farm, `Bun.build`), a webpack-style loader (Turbopack), and a TypeScript 7.1 content mapper. The prototype is a `.toml` importer; the same `main.ts` runs and type-checks under every host with the same import statement.

```ts
import config, { loadedBy } from "./config.toml";
//     ^? { name: string; port: number; debug: boolean; tags: string[]; server: { host: string } }
```

## 1. Can a content mapper run only for `bunfig.toml`?

Not by name. TypeScript matches a content mapper by a dotted suffix at a `.` boundary, and nothing else. The prototype's `name-match` experiments (section 7.3) show each case against the nightly.

| `extensions` entry | File | What tsc does | Where the rule lives |
| --- | --- | --- | --- |
| `"bunfig.toml"` | any | `TS100020: Content mapper file extension 'bunfig.toml' must begin with a '.'.` | `tsconfigparsing.go` line 1412 |
| `".bunfig.toml"` | `bunfig.toml` | Not matched. `TS2307: Cannot find module './bunfig.toml'`. The matcher requires the character before the suffix to be `.`, and here it is `/`. | `tspath/path.go` `tryGetExtensionFromPath`: `path[len(path)-len(extension)] == '.'` |
| `".bunfig.toml"` | `app.bunfig.toml` | Matched and transformed. A compound suffix works when a `.` precedes it. | same, plus `GetLongestExtensionFromPath` (the longest registered suffix wins) |
| `".ts"` | any | `TS100021`, a built-in extension cannot be registered. | `tsconfigparsing.go` line 1414 |
| `".toml"` in two mappers | any | `TS100022: Content mapper file extension '.toml' is registered by more than one content mapper.` The second registration is dropped. | `tsconfigparsing.go` line 1420 |

Three consequences follow from the code.

- The unit is a suffix, not an extension in the `path.extname` sense: `.module.css`, `.config.toml` and `.d.foo` are all legal, and `foo.config.toml` goes to the `.config.toml` mapper before a `.toml` mapper. A bare basename such as `bunfig.toml` has no `.` in front of it, so no registration reaches it except `.toml`.
- There is no decline in the protocol. The `transform` result is `{ text, extension, mappings?, diagnostics?, supplemental?, diagnosticDirectives? }` (`hostimpl.go` `MappedOutput`), `extension` must be one of `.js .jsx .mjs .cjs .ts .tsx .mts .cts .json` (`contentmapper.go` line 58), and an error or malformed response is `TS100025: The content mapper '<name>' failed to transform this file` with the file treated as an empty module; after five failures in a project the mapper is switched off (`TS100026`; PR #4712: "If the mapper fails in an unexpected way (e.g., crashes or doesn't conform to the protocol), TypeScript reports a localized diagnostic and treats the file as an empty TypeScript file. After five failures in a single project, TypeScript stops attempting to transform files with that mapper"). A mapper that does not want a file therefore answers with a valid empty module, `{ extension: ".ts", text: "" }`. The importer then sees `TS1192: Module '…/other.toml' has no default export`, which is verified in 7.3. A mapper can instead return a diagnostic with a message that names the file, which reads better; both are the mapper's choice.
- Claiming `.toml` claims every `.toml` under `include`. The extensions of every mapper are appended to tsc's root-file glob (`parsedcommandline.go` `fileGlobPatterns`), so with `include: ["."]` each `.toml` file in the tree is a root file and is transformed whether or not anything imports it (verified in 7.3: four transform requests, one import). A plugin that wants only `bunfig.toml` must keep `include` narrow or must be cheap and quiet for the files it declines.

So the honest answer is: at runtime and in bundlers a plugin can match a file name exactly; in TypeScript it claims the suffix and declines the rest. The loader plugin contract (section 2) carries a `test` RegExp for the first and does the decline for the second inside the mapper adapter.

## 2. The contract

The full source is [`lab/universal/plugin/universal.ts`](../lab/universal/plugin/universal.ts); the definition below is what a plugin author writes.

```ts
export interface LoaderPlugin {
  name: string;                       // also the content mapper's diagnostic source
  extensions: readonly string[];      // ".toml"; the only unit TypeScript understands
  test?: RegExp;                      // narrower match on the absolute path; honoured by every runtime and bundler, not by tsc
  load(source: string, path: string): {
    code: string;                     // JavaScript ES module for runtimes and bundlers
    types?: string;                   // TypeScript module for the checker; absent means "wildcard declare module only"
    diagnostics?: { messageText: string; start: number; length: number; code: number }[];  // positions in the original file
  };
}
```

The shape is the intersection of section 3, and each field is there because one host forces it.

- The match is a RegExp, not a function, because Bun and esbuild accept only a RegExp filter, and Bun's runtime throws when `onLoad` returns `undefined` (oven-sh/bun#5303), so the filter must be exact before the callback runs. esbuild compiles the filter with Go's RE2, so the RegExp stays free of lookaround.
- The hook is synchronous because Node's `module.registerHooks` and unloader are synchronous; an `async load` is rejected by unloader with `unloader only supports synchronous hooks` (`docs/unplugin.md` section 7 in dotsql).
- Two texts, `code` and `types`, because runtimes and bundlers take JavaScript and the checker takes TypeScript, and the two differ whenever the runtime object is built by a call (`defineQuery({...})` in Porg) while the type is declared (`declare const query: Query<...>`). A single TypeScript text would serve Node (`format: "module-typescript"`), Bun (`loader: "ts"`), esbuild (`loader: "ts"`) and tsc (`.ts`), but not Vite or webpack through unplugin, whose `load` must return JavaScript for esbuild and whose transpile step keys on the id's extension. The prototype does not exercise the single-text path.
- Diagnostics are positioned in the original file because that is the one form the checker can render; each runtime adapter throws an `Error` with the same messages, verified under Bun and nub in 7.3.

The prototype plugin in [`lab/universal/plugin/plugin.ts`](../lab/universal/plugin/plugin.ts) parses a TOML subset, emits `export default <json>; export const loadedBy = "universal-toml";` as `code`, and `declare const data: <widened type>; export default data; export declare const loadedBy: "universal-toml";` as `types`. Its `test` is `/(^|[\\/])(config|bunfig)\.toml$/`, so it is a "specific file name" plugin.

## 3. The lowest common denominator

Each host, its hook surface, and what it cannot do. Sources are the docs and code named in section 8; "verified" means the prototype ran it.

| Host | Hook surface | Match | Returns | Cannot | Status |
| --- | --- | --- | --- | --- | --- |
| Node ≥ 22.18 | `module.registerHooks({ resolve, load })`, synchronous, in-thread, registered from `--import` | any code in the hook (`url`, `context.format`, `importAttributes`) | `{ format, source, shortCircuit }`; `format` is one of `addon builtin commonjs commonjs-typescript json module module-typescript wasm` | change what tsc types; run asynchronously; apply without `--import` or `NODE_OPTIONS` | verified (`--import universal-toml/register`) |
| nub | the same `registerHooks` pair, injected through `nub.jsonc` `preload` or `--import`; nub's own hooks register first, so a plugin's hook runs first (LIFO) | same as Node | same as Node | same as Node; a plugin cannot reach nub's built-in `loader` map (`RUNTIME_LOADER` is extension-keyed) | verified (`nub.jsonc` preload and `--import`); the plugin overrode nub's built-in `.toml` loader |
| Bun runtime and `Bun.build()` | `Bun.plugin({ setup(build) { build.onResolve / build.onLoad } })`, `onLoad({ filter: RegExp, namespace? })` | RegExp on the path | `{ loader, contents }`, `loader` one of Bun's loaders (`js ts tsx json toml text …`); the callback must return an object | decline inside the callback (#5303); apply without `--preload` or `bunfig.toml` `preload`; the `bun build` CLI takes no plugins | verified (`--preload`, `Bun.build()`) |
| esbuild | `build.onResolve({ filter, namespace })`, `build.onLoad({ filter, namespace })` | RegExp, Go RE2 syntax, on the resolved path | `{ contents, loader }`; the first callback that returns `contents` wins | narrow on anything the regex cannot express; types | verified (bare adapter) |
| Vite, Rollup, Rolldown | `resolveId`, `load`, `transform` (each with an optional `filter`), `enforce: "pre" | "post"` (Vite only) | `filter.id` or code in the hook | `load` returns code (string or `{ code, map }`) | run in Turbopack, Parcel, Metro, `wrangler`; Vite dev cannot transpile TypeScript returned for a `.toml` id, so `code` must be JavaScript | not run; reached through unplugin, whose esbuild adapter is verified |
| webpack 5, Rspack, Rsbuild, Farm | plugin (`apply(compiler)`) or a loader in `module.rules` | `test` RegExp in the rule | loader returns a string | Rspack `resolveId` needs ≥ 1.0.0-alpha.1 | not run; reached through unplugin |
| Next.js Turbopack | a webpack-style loader in `turbopack.rules`, plain-value options only | glob in the rule (`"*.toml"`) | JavaScript string ("Only loaders that return JavaScript code are supported") | run an unplugin plugin (it needs the live plugin object in `this.query`) | verified with a loader context only, not inside Next |
| TypeScript 7.1 content mapper | JSON-RPC `initialize`, `openProject`, `transform(fileName, content)`, `closeProject`; spawned from `typescript.contentMapper.exec` with cwd = the package | extension suffix from tsconfig `contentMappers[].extensions` | `{ extension, text, mappings?, diagnostics?, supplemental? }`, `extension` in the virtual list (no `.d.ts`) | affect emitted JavaScript; match by file name; decline; run without `--runExternalCode`; run on TypeScript < 7.1 | verified (exact-type checks, trace) |

The intersection is small and is exactly the contract in section 2: a name, a suffix list, an optional path RegExp, one synchronous `load` that returns JavaScript, and a second text for the checker. Everything outside the intersection is host-specific and stays in the adapter: Node's `format`, Bun's `loader`, esbuild's `namespace`, Vite's `enforce`, the mapper's `mappings`, `supplemental` and `dynamicConfig`.

What a plugin gives up per host:

- On tsc it gives up runtime effect. The mapper output exists only inside the checker's program; tsc emits no JavaScript for a mapped file and leaves the import specifier alone (section 16 of the porg repository's `DESIGN.md`, `lab/emit`).
- On Node, nub and Bun it gives up types. A load hook cannot tell tsc anything; the type comes from the mapper or from a wildcard `declare module "*.toml"` shipped in a `.d.ts`.
- On Bun and esbuild it gives up a function matcher; on tsc it gives up any matcher beyond the suffix.
- On every bundler through unplugin it gives up TypeScript output; `code` is JavaScript.
- On Bun it gives up ambient activation: `bun x.ts` needs `--preload` or `bunfig.toml`; `Bun.build()` takes the same object, the `bun build` CLI takes nothing.
- On Turbopack it gives up plugin objects and options that are not plain values.

## 4. Adapters

Every adapter is a pure function of the plugin object. From [`universal.ts`](../lab/universal/plugin/universal.ts):

```ts
toNodeHooks(plugin)        // { load(url, context, nextLoad) }: matches → { format: "module", source: code, shortCircuit: true }, else nextLoad
toBunPlugin(plugin)        // { name, setup(build) { build.onLoad({ filter }, ({ path }) => ({ loader: "js", contents })) } }; same object for Bun.plugin and Bun.build
toEsbuildPlugin(plugin)    // { name, setup(build) { build.onLoad({ filter, namespace: "file" }, ({ path }) => ({ contents, loader: "js" })) } }
toUnpluginOptions(plugin)  // { name, loadInclude: matches, load: code } for createUnplugin → .vite .rollup .rolldown .webpack .rspack .farm .esbuild .bun
toWebpackLoader(plugin)    // function (source) { return plugin.load(source, this.resourcePath).code }; turbopack.rules and module.rules
toMapperHandlers(plugin)   // { initialize, openProject, transform, closeProject } for the JSON-RPC server; transform → { extension: ".ts", text: types, diagnostics } or the empty module
```

The package then exposes one subpath per host, and the manifest names the two that hosts discover on their own:

```jsonc
{
  "name": "universal-toml",
  "exports": {
    ".": "./plugin.ts",                       // the definition
    "./register": "./register.ts",            // node --import, nub preload, bun --preload
    "./esbuild": "./esbuild.ts",
    "./unplugin": "./unplugin.ts",
    "./turbopack-loader": "./turbopack-loader.ts"
  },
  "typescript": { "contentMapper": { "exec": ["node", "mapper.ts"], "compilerOptions": [] } },   // read by tsc
  "nub": { "preload": "./register", "extensions": [".toml"] }                                    // read by nub, section 5
}
```

The preload picks the runtime by capability, as `porg/register` does: `typeof Bun !== "undefined"` → `Bun.plugin(...)`, else `registerHooks(...)`. A preload-only export condition does not exist in Node or Bun (docs/conditions.md section 1), so the register subpath stays separate from the main entry.

## 5. How nub registers a loader plugin

This section builds on nub's own plan in `internal/runtime/plugins.md` (2026-09-14) and keeps its decisions D1 to D3; the prototype's manifest is that plan's manifest.

```jsonc title="nub.jsonc"
{
  // package names or paths, explicit; never auto-activated from dependencies
  "plugins": ["universal-toml"],
  // the low-level list stays; a plugin's preload is injected before these
  "preload": ["./instrumentation.ts"]
}
```

What nub does with one entry:

| Contribution | Manifest field | When | Mechanism | Status in the prototype |
| --- | --- | --- | --- | --- |
| runtime hook | `nub.preload` | every `nub <file>`, `nub run`, `nubx` | prepend `<pkg>/<preload>` to the preload injection, the same path as `nub.jsonc` `preload` | verified through today's `preload: ["universal-toml/register"]` and `--import`; the `plugins` key does not exist yet |
| content mapper | `typescript.contentMapper` (tsc's field) plus `nub.extensions` | `nub plugin sync` | write `{ "package": "<pkg>", "extensions": [...] }` into the project's `tsconfig.json` `contentMappers`; `nub check` adds `--runExternalCode` when the effective tsconfig has mappers | the tsconfig entry was written by hand; the mapper half is verified |
| wildcard types | `nub.types` (a `.d.ts` subpath) | `nub plugin sync` | `/// <reference types="<pkg>/types" />` in `nub-env.d.ts` | not in the prototype; it is the tier for TypeScript < 7.1 |

The answers to the questions in the brief:

- One package serves as runtime plugin and mapper. Verified: `universal-toml` is the `--import` target, the `bunfig`/`--preload` target, the `contentMappers[].package`, and the esbuild plugin, from one `plugin.ts`. The mapper is spawned by tsc from `typescript.contentMapper.exec` with cwd = the package directory, so `["node", "mapper.ts"]` works without a build step on a runtime that strips types.
- The `contentMappers` entry is generated by nub on the explicit sync verb, never at check time only. The editor reads `tsconfig.json`, not nub; an entry that exists only inside `nub check` gives a green check next to a red editor (plugins.md section 4.3). The manifest's `nub.extensions` field exists because tsc's own manifest has no extensions field; the tsconfig entry carries them.
- Discovery stays explicit. A `nub add` hint when the added package has a `nub` manifest is enough (plugins.md D3).
- The abstraction does not live in nub. It is a small library a plugin package depends on (the seven functions in `universal.ts`); nub's role is activation (preload injection), sync (tsconfig, `nub-env.d.ts`) and the `--runExternalCode` flag. nub can publish that library as its own package so that a plugin author writes `plugin.ts` and five one-line subpath files, but nothing in nub's binary needs to know the contract.
- File names in nub. nub's built-in `loader` map is extension-keyed (`RUNTIME_LOADER[ext]` in `runtime/transform-core.mjs`), so "only `bunfig.toml`" is not expressible there either; a loader plugin with a `test` RegExp is the way, and the same plugin declines the other `.toml` files in the mapper.

Two things the prototype shows that the plan should absorb:

- A plugin's hook overrides nub's built-in data loader for the same extension with no conflict rule; the control run without the preload took nub's `.toml` loader and failed on the named import, the run with it took the plugin. This matches plugins.md section 6 ("document, do not engineer") and now has a verified case.
- When a plugin package also declares `typescript.contentMapper`, `nub plugin sync` should warn if `include` in the discovered tsconfig covers directories with many files of the claimed suffix, because each becomes a root file and a transform request (section 1).

## 6. Prototype files

```text
lab/universal/
  README.md                        commands, one per host
  plugin/                          the package "universal-toml"
    plugin.ts                      ONE definition: TOML-subset parser, load() → { code, types, diagnostics }
    universal.ts                   LoaderPlugin contract + toNodeHooks, toBunPlugin, toEsbuildPlugin, toUnpluginOptions, toWebpackLoader, toMapperHandlers
    register.ts                    preload for node --import, nub, bun --preload
    esbuild.ts                     esbuild plugin export
    unplugin.ts                    createUnplugin factory (.vite .rollup .webpack .rspack .esbuild .bun)
    turbopack-loader.ts            webpack-style loader export
    mapper.ts                      content mapper process (serve(toMapperHandlers(plugin)))
    rpc.ts                         Content-Length JSON-RPC server, copied from the porg repository's src/rpc.ts
    package.json                   exports, typescript.contentMapper, nub manifest
  app/                             the consumer
    config.toml, main.ts           the import and the exact-type checks
    tsconfig.json                  contentMappers: [{ package: "universal-toml", extensions: [".toml"] }]
    nub.jsonc                      preload: ["universal-toml/register"]
    build-esbuild.mjs              bare adapter and unplugin adapter, writes dist/
    build-bun.ts                   Bun.build() with toBunPlugin(plugin)
    node_modules/universal-toml    symlink → ../../plugin
  name-match/                      the question-A fixtures
    bunfig.toml, app.bunfig.toml, other.toml, bad/config.toml
    import-bunfig.ts, import-compound.ts, import-other.ts, import-bad.ts
    tsconfig.{bare-name,dot-name,decline,two-mappers,include-all,diagnostic}.json
    node_modules/universal-toml, universal-toml-2   symlinks → ../../plugin
```

## 7. Verification transcript

Every command below ran on 2026-09-18 from the directory shown; output is pasted verbatim, trimmed only where marked. `$TSC` is the repository's `node_modules/.bin/tsc`.

### 7.1 One `main.ts`, five hosts

```sh
cd lab/universal/app

node main.ts
# EXIT=1  TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".toml" for …/lab/universal/app/config.toml

node --import universal-toml/register main.ts
# EXIT=0  {"loadedBy":"universal-toml","port":8080,"host":"localhost"}

nub main.ts                                   # nub.jsonc renamed away: nub's built-in TOML loader serves the file
# EXIT=1  SyntaxError: The requested module './config.toml' does not provide an export named 'loadedBy'
nub main.ts                                   # nub.jsonc: { "preload": ["universal-toml/register"] }
# EXIT=0  {"loadedBy":"universal-toml","port":8080,"host":"localhost"}
nub --import universal-toml/register main.ts  # no nub.jsonc
# EXIT=0  {"loadedBy":"universal-toml","port":8080,"host":"localhost"}

bun main.ts                                   # Bun's native TOML loader serves the file
# EXIT=1  SyntaxError: Export named 'loadedBy' not found in module '…/lab/universal/app/config.toml'.
bun --preload universal-toml/register main.ts
# EXIT=0  {"loadedBy":"universal-toml","port":8080,"host":"localhost"}

node -e '…esbuild.build({ entryPoints: ["main.ts"], bundle: true })…'   # no plugin
# No loader is configured for ".toml" files: config.toml
node build-esbuild.mjs
# EXIT=0
# bare: errors=0 warnings=0 bytes=318 hasLoadedBy=true
# unplugin: errors=0 warnings=0 bytes=318 hasLoadedBy=true
node dist/main.bare.mjs
# {"loadedBy":"universal-toml","port":8080,"host":"localhost"}
node dist/main.unplugin.mjs
# {"loadedBy":"universal-toml","port":8080,"host":"localhost"}
bun build-bun.ts
# EXIT=0  success=true logs=0 hasLoadedBy=true

node --input-type=module -e 'import loader from "universal-toml/turbopack-loader"; … loader.call({ resourcePath: cwd + "/config.toml" }, source)'
# export default {"name":"demo","port":8080,"debug":true,"tags":["a","b"],"server":{"host":"localhost"}};
# export const loadedBy = "universal-toml";

$TSC -p tsconfig.json --noEmit                    # control, no flag
# EXIT=2
# main.ts(1,34): error TS2307: Cannot find module './config.toml' or its corresponding type declarations.
# main.ts(8,1): error TS2578: Unused '@ts-expect-error' directive.
# tsconfig.json(11,3): error TS100024: Content mappers require the '--runExternalCode' command line flag to be enabled.
$TSC -p tsconfig.json --noEmit --runExternalCode
# EXIT=0
```

The bundled module esbuild produced for `config.toml`:

```js
// config.toml
var config_default = { "name": "demo", "port": 8080, "debug": true, "tags": ["a", "b"], "server": { "host": "localhost" } };
var loadedBy = "universal-toml";
```

The exact-type checks in `main.ts` assign `config` to the expected type and back, assign `loadedBy` to the literal `"universal-toml"`, and carry one `@ts-expect-error`. A negative control with `port: string` in the expected type fails both ways:

```text
main.broken.ts(5,7): error TS2322: Type '{ name: string; port: number; debug: boolean; tags: string[]; server: { host: string; }; }' is not assignable to type 'Expected'.
  Types of property 'port' are incompatible.
    Type 'number' is not assignable to type 'string'.
main.broken.ts(6,7): error TS2322: Type 'Expected' is not assignable to type '{ name: string; port: number; debug: boolean; tags: string[]; server: { host: string; }; }'.
```

### 7.2 The JSON-RPC trace

```sh
TS_CONTENT_MAPPER_DEBUG=1 $TSC -p tsconfig.json --noEmit --runExternalCode
# methods: 1 initialize, 1 openProject, 1 transform, 1 closeProject
# send:    {"jsonrpc":"2.0","id":"api3","method":"transform","params":{"fileName":"…/app/config.toml","content":"# Demo config …","projectHandle":"universal-toml@0.0.0:0"}}
# receive: {"jsonrpc":"2.0","id":"api3","result":{"extension":".ts","text":"declare const data: { name: string; port: number; debug: boolean; tags: string[]; server: { host: string } };\nexport default data;\nexport declare const loadedBy: \"universal-toml\";\n","diagnostics":[]}}
```

### 7.3 File-name matching

```sh
cd lab/universal/name-match

$TSC -p tsconfig.bare-name.json --noEmit --runExternalCode        # extensions: ["bunfig.toml"]
# EXIT=2
# import-bunfig.ts(1,20): error TS2307: Cannot find module './bunfig.toml' or its corresponding type declarations.
# tsconfig.bare-name.json(1,226): error TS100020: Content mapper file extension 'bunfig.toml' must begin with a '.'.

$TSC -p tsconfig.dot-name.json --noEmit --runExternalCode         # extensions: [".bunfig.toml"]; imports bunfig.toml and app.bunfig.toml
# EXIT=2
# import-bunfig.ts(1,20): error TS2307: Cannot find module './bunfig.toml' or its corresponding type declarations.
# import-compound.ts(1,8): error TS1192: Module '"…/name-match/app.bunfig.toml"' has no default export.
# transform requests: app.bunfig.toml only (the plugin's test declined it, so it became the empty module)

$TSC -p tsconfig.decline.json --noEmit --runExternalCode          # extensions: [".toml"]; imports bunfig.toml and other.toml
# EXIT=2
# import-other.ts(1,8): error TS1192: Module '"…/name-match/other.toml"' has no default export.
# transform requests: other.toml → {"extension":".ts","text":"","diagnostics":[]}; bunfig.toml → declare const data: { preload: string[] } …

$TSC -p tsconfig.two-mappers.json --noEmit --runExternalCode      # universal-toml and universal-toml-2 both claim .toml
# EXIT=2
# tsconfig.two-mappers.json(1,286): error TS100022: Content mapper file extension '.toml' is registered by more than one content mapper.

$TSC -p tsconfig.include-all.json --noEmit --runExternalCode      # include: ["."], one importer
# EXIT=2
# bad/config.toml(2,8): error universal-toml1: Unsupported TOML value: eighty
# transform requests: bad/config.toml, bunfig.toml, other.toml, app.bunfig.toml   (four files, one imported)

$TSC -p tsconfig.diagnostic.json --noEmit --runExternalCode       # import-bad.ts imports bad/config.toml
# EXIT=2
# bad/config.toml(2,8): error universal-toml1: Unsupported TOML value: eighty
```

The runtime side of the same fixtures:

```sh
node --import universal-toml/register import-bunfig.ts      # EXIT=0
node --import universal-toml/register import-other.ts       # EXIT=1  ERR_UNKNOWN_FILE_EXTENSION (declined → nextLoad → Node has no .toml loader)

cd lab/universal                                            # not name-match: Bun reads a bunfig.toml in its cwd as its own config
bun --preload ./plugin/register.ts name-match/import-bunfig.ts   # EXIT=0
bun --preload ./plugin/register.ts name-match/import-other.ts    # EXIT=0  { kind: "other" }   (declined by the filter → Bun's native TOML loader)
bun --preload ./plugin/register.ts name-match/import-bad.ts      # EXIT=1  error: universal-toml: …/bad/config.toml: Unsupported TOML value: eighty

cd lab/universal/name-match
nub --import universal-toml/register import-bunfig.ts       # EXIT=0
nub --import universal-toml/register import-other.ts        # EXIT=0  { kind: 'other' }   (declined → nub's built-in TOML loader)
nub --import universal-toml/register import-bad.ts          # EXIT=1  Error: universal-toml: …/bad/config.toml: Unsupported TOML value: eighty
```

## 8. Not verified

- Vite, Rollup, Rolldown, webpack, Rspack, Farm and Next.js were not run; those rows rest on the unplugin hook table and the docs cited in dotsql's docs/unplugin.md. The unplugin adapter was exercised through esbuild only.
- The single-TypeScript-text variant (`format: "module-typescript"` from a Node load hook, `loader: "ts"` in Bun and esbuild) was not run.
- The `plugins` key in `nub.jsonc`, `nub plugin sync` and `nub check` do not exist yet; the nub rows use today's `preload` and `--import`.
- Deno was not run (dotsql's docs/unplugin.md section 7 records a hang on any synchronous `load` hook under Deno 2.8.1).
- The mapper crash path (`TS100025`, `TS100026`) was read in `fileloader.go` and in the `contentMapperFailures` baselines, not reproduced.

## 9. Sources

- microsoft/TypeScript at `4ba2fafe7b605c38d963d3697128e34b9e9c7618`: `tsc/internal/tsoptions/tsconfigparsing.go` (extension validation, lines 1412 to 1420), `tsc/internal/tsoptions/parsedcommandline.go` (`fileGlobPatterns`, `GetContentMapperForFileName`), `tsc/internal/tspath/path.go` (`tryGetExtensionFromPath`, line 941), `tsc/internal/contentmapper/contentmapper.go` (`supportedVirtualExtensions`, line 58), `tsc/internal/contentmapper/hostimpl.go` (`MappedOutput`, `handshake`, `decodeTransformResult`), read through `gh api repos/microsoft/TypeScript/contents/...`. The same code was read in the archived typescript-go checkout at `89d5d5b` (`internal/compiler/fileloader.go` for `TS100025`, `testdata/baselines/reference/tsc/contentMapperFailures/`).
- microsoft/typescript-go PR #4712 (merged 2026-08-19), description read through `gh pr view 4712 --json body`: https://github.com/microsoft/typescript-go/pull/4712
- Node: https://github.com/nodejs/node/blob/main/doc/api/module.md (`module.registerHooks`, the "Accepted final formats returned by `load`" table)
- Bun: https://bun.com/docs/runtime/plugins (`onLoad({ filter, namespace })`, loaders); https://github.com/oven-sh/bun/issues/5303
- esbuild: https://esbuild.github.io/plugins/ (filters are regular expressions in Go syntax; the first `onLoad` that sets `contents` wins)
- Vite: https://vite.dev/guide/api-plugin (`resolveId`, `load`, `transform`, `enforce`)
- Next.js Turbopack: https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack
- unplugin: https://unplugin.unjs.io/guide/ and dotsql's docs/unplugin.md and docs/conditions.md, and sections 1, 2, 13, 14 and 16 of the porg repository's DESIGN.md
- nub: `runtime/preload.mjs`, `runtime/loader-entry.mjs`, `runtime/transform-core.mjs` (`BUILTIN_DATA_EXTS`, `RUNTIME_LOADER`, `loadData`), `runtime/preload-common.cjs` (the load hook), `npm/nub-types/common.d.ts` (`declare module "*.toml"`), `internal/runtime/plugins.md`, `internal/commands/check.md`, `site/content/docs/config.mdx` (`preload`, `loader`)
