# Lab: one universal plugin, five hosts

> [!NOTE]
> This is the loader template, copied on 2026-10-03 from dotsql (`~/Documents/projects/dotsql/lab/universal` at `e880388`), where it came from the porg repository (`~/Documents/projects/lando`, commit `bb06418` there, `478942c` in dotsql). motherload's loader in [src/](../../src) started from it ([DESIGN.md](../../DESIGN.md#the-starting-point-the-loader-template)); the template itself stays as it was, a record that each host runs one loader definition. Here `universal-toml` and `universal-toml-2` resolve through the repository's root `node_modules`, linked by `package.json`, so the commands below need no symlinks. `nub run typecheck` runs the content mapper check of `app/`.

`plugin/` is one npm package (`universal-toml`) with ONE plugin definition in `plugin/plugin.ts` and the contract plus adapters in `plugin/universal.ts`. `app/` imports `./config.toml` from `main.ts` and runs unchanged under Node, nub, Bun, esbuild (bare plugin and unplugin) and the TypeScript 7.1 content mapper. `name-match/` holds the tsconfig variants that answer "can a mapper run only for `bunfig.toml`?". The write-up is [`docs/universal-plugin.md`](../../docs/universal-plugin.md).

```sh
cd lab/universal/app
node main.ts                                              # control: ERR_UNKNOWN_FILE_EXTENSION
node --import universal-toml/register main.ts             # Node preload
nub main.ts                                               # nub.jsonc preload: ["universal-toml/register"]
nub --import universal-toml/register main.ts              # nub, flag form
bun --preload universal-toml/register main.ts             # Bun preload
node build-esbuild.mjs && node dist/main.bare.mjs         # esbuild, bare adapter and unplugin adapter
bun build-bun.ts                                          # Bun.build() with the same Bun plugin object
../../../node_modules/.bin/tsc -p tsconfig.json --noEmit --runExternalCode   # content mapper; exact-type checks in main.ts
TS_CONTENT_MAPPER_DEBUG=1 ../../../node_modules/.bin/tsc -p tsconfig.json --noEmit --runExternalCode   # JSON-RPC trace

cd ../name-match
for c in bare-name dot-name decline two-mappers include-all diagnostic; do ../../../node_modules/.bin/tsc -p tsconfig.$c.json --noEmit --runExternalCode; done
```

Run Bun from `lab/universal` (not from `name-match/`), because Bun reads a `bunfig.toml` in its cwd as its own configuration and `name-match/bunfig.toml` is a fixture.
