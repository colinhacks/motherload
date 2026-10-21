# Motherload with Bun

A script and its test that import a TOML file, a CSV file and a Markdown file as typed modules, loaded by Motherload's preload from `bunfig.toml`, and a bundle of the script built by `Bun.build` with Motherload's esbuild plugin ([Bun](https://motherload.dev/#setup-bun)).

## Run it

```sh
nub run typecheck   # tsc --noEmit --runExternalCode: no output, exit 0
nub run start       # bun main.ts: {"title":"Motherload example","port":8080,"users":["Ada Lovelace","Hopper, Grace"],"post":"Hello, Motherload"}
nub run test        # bun test: 1 pass, 0 fail
nub run build       # bun build.ts: "built …/dist/main.js"
nub run start:dist  # bun dist/main.js: the bundle, the same line as start
```

The same scripts run with `bun run <script>`.

## How Motherload is wired in

- In `package.json`, `motherload` is a dependency, not a development dependency: the preload turns each data file into a module when the script runs. The development dependencies are `typescript` 7.1 beta and Bun's types, `@types/bun`. The `start` script is `bun main.ts`, `test` is `bun test`, `build` is `bun build.ts` and `start:dist` is `bun dist/main.js`, and `typecheck` runs `tsc --noEmit --runExternalCode`, which runs the content mapper.
- The `bunfig.toml` file sets `preload = ["motherload/register"]`, which Bun loads before the script, so `bun main.ts` imports data files with no flag; and the same line under `[test]`, because `bun test` reads its own preload and not the top-level one.
- The `build.ts` file runs `Bun.build` with `plugins: [motherload()]` from `motherload/esbuild`, which builds each data file into the bundle as its value: `dist/main.js` imports nothing and runs without the preload.
- In `tsconfig.json`, `contentMappers` names `motherload` for `.toml`, `.csv` and `.md`, the three formats the project imports, and `types: ["bun"]` loads Bun's types, which TypeScript 7 loads only when named. The `allowImportingTsExtensions` option lets `main.ts` import `./site.ts` by its own name, as Bun runs it.
- The module `site.ts` imports `config.toml`, `users.csv` and `post.md` and reads a value from each; `main.ts` prints them, and `site.test.ts` checks them, with a `@ts-expect-error` on a key `config.toml` does not have.
- The `.vscode/` and `.zed/` directories hold the editor settings from [Editors](https://motherload.dev/#editors).

## In your own project

- Run `bun add motherload` and `bun add -d typescript@beta @types/bun` instead of the `link:` dependency on `../..`.
- Nothing else here exists only because Motherload is linked from this repository.

## Notes

- Bun reads `.toml` files itself, and the preload and the plugin take them over: with Motherload a TOML integer above 2^53 is a `bigint` and an offset date-time a `Date`, where Bun's own loader fails on the integer and makes the date-time a `Temporal.Instant`.
- Without the preload, Bun imports `users.csv` as its path, a string, and `post.md` as HTML, so `site.ts` fails with `users.map is not a function`.
- Without the `[test]` preload, `bun test` fails the same way, though the top-level preload is set.
- Running `bun dist/main.js` still loads the preload of `bunfig.toml` in this directory, though the bundle never uses it: copied alone into an empty directory, `bun main.js` prints the same line.
