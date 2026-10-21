# Motherload with esbuild

A script that imports a TOML file, a CSV file and a Markdown file as typed modules, bundled by esbuild with Motherload's plugin into one ES module, `dist/main.mjs`, which runs with plain Node and needs no Motherload, no TypeScript and no `node_modules` ([esbuild](https://motherload.dev/#setup-esbuild)).

## Run it

```sh
nub run typecheck   # tsc --noEmit --runExternalCode: no output, exit 0
nub run dev         # the source under the preload, no build: {"title":"Motherload example","port":8080,"users":["Ada Lovelace","Hopper, Grace"],"post":"Hello, Motherload"}
nub run test        # Node's test runner under the preload: 1 test, 1 pass
nub run build       # the type check, then esbuild: "built dist/main.mjs"
nub run start       # node dist/main.mjs: the same line as dev
```

The bundle needs nothing beside it. Copy it anywhere and run it:

```sh
mkdir /tmp/app && cp dist/main.mjs /tmp/app/ && cd /tmp/app
node main.mjs       # the same line
```

## How Motherload is wired in

- In `package.json`, `motherload` is a development dependency, with `esbuild`, `typescript` 7.1 beta and `@types/node`: the plugin builds each data file into the bundle as its value, so the bundle loads no Motherload when it runs.
- In `build.mjs`, `plugins: [motherload()]` from `motherload/esbuild` turns each data file into a module at build time. The build runs through `esbuild.build`, since esbuild runs plugins in `.build()` only and `.buildSync()` throws, with `platform: "node"` and `format: "esm"` for an ES module that Node runs.
- In the `package.json` scripts, `typecheck` is `tsc --noEmit --runExternalCode`, which runs the content mapper. The `build` script runs that type check before `node build.mjs`, because esbuild strips types without checking them. The `dev` and `test` scripts run the sources under `--import motherload/register`, so development needs no build, and `start` runs the bundle with no preload.
- In `tsconfig.json`, `contentMappers` names `motherload` for `.toml`, `.csv` and `.md`, the three formats the project imports. The `allowImportingTsExtensions` option lets `main.ts` import `./site.ts` by its own name, as Node runs it under `dev`.
- The module `site.ts` imports `config.toml`, `users.csv` and `post.md` and reads a value from each; `main.ts` prints them, and `site.test.ts` checks them, with a `@ts-expect-error` on a key `config.toml` does not have.
- The `.vscode/` and `.zed/` directories hold the editor settings from [Editors](https://motherload.dev/#editors).

## In your own project

- Run `npm install -D motherload esbuild typescript@beta @types/node` instead of the `link:` dependency on `../..`.
- Nothing else here exists only because Motherload is linked from this repository.

## Notes

- Without the plugin, esbuild stops at each data file: `No loader is configured for ".toml" files: config.toml`, and the same for `.csv` and `.md`.
- Called with the plugin, `esbuild.buildSync` throws `Cannot use plugins in synchronous API calls`.
