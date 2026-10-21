# Motherload with Node

A script and its test that import a TOML file, a CSV file and a Markdown file as typed modules, loaded by Motherload's preload under `node --import` ([Node](https://motherload.dev/#setup-node)).

## Run it

```sh
nub run typecheck   # tsc --noEmit --runExternalCode: no output, exit 0
nub run start       # {"title":"Motherload example","port":8080,"users":["Ada Lovelace","Hopper, Grace"],"post":"Hello, Motherload"}
nub run test        # Node's test runner: 1 test, 1 pass
```

## How Motherload is wired in

- In `package.json`, `motherload` is a dependency, not a development dependency: the preload turns each data file into a module when the script runs. TypeScript 7.1 beta and `@types/node` are development dependencies. The `start` and `test` scripts pass `--import motherload/register` to `node`, and `typecheck` runs `tsc --noEmit --runExternalCode`, which runs the content mapper.
- In `tsconfig.json`, `contentMappers` names `motherload` for `.toml`, `.csv` and `.md`, the three formats the project imports. The `allowImportingTsExtensions` option lets `main.ts` import `./site.ts` by its own name, as Node runs it.
- The module `site.ts` imports `config.toml`, `users.csv` and `post.md` and reads a value from each; `main.ts` prints them, and `site.test.ts` checks them, with a `@ts-expect-error` on a key `config.toml` does not have.
- The `.vscode/` and `.zed/` directories hold the editor settings from [Editors](https://motherload.dev/#editors).

## In your own project

- Run `npm install motherload` and `npm install -D typescript@beta @types/node` instead of the `link:` dependency on `../..`.
- Nothing else here exists only because Motherload is linked from this repository.
