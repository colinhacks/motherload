# Motherload with webpack

A script that imports a TOML file, a CSV file and a Markdown file as typed modules, bundled by webpack 5 through Motherload's loader into one ES module, `dist/main.mjs`, that runs with plain Node and no Motherload installed ([webpack](https://motherload.dev/#setup-webpack)).

## Run it

```sh
nub run typecheck   # tsc --noEmit --runExternalCode: no output, exit 0
nub run build       # webpack: "webpack 5.112.0 compiled successfully", writes dist/main.mjs
nub run start       # node dist/main.mjs: {"title":"Motherload example","port":8080,"users":["Ada Lovelace","Hopper, Grace"],"post":"Hello, Motherload"}
nub run dev         # the sources under the preload, run again on every change to a .ts or data file
```

The bundle holds each file's parsed values and imports nothing, so `dist/main.mjs` prints the same line when copied alone into an empty directory and run there with `node`.

## How Motherload is wired in

- In `package.json`, `motherload` is a development dependency: the loader runs at build time, and the bundle carries the values. The packages `typescript` 7.1 beta, `webpack`, `webpack-cli`, `swc-loader`, `@swc/core` and `@types/node` are development dependencies too. The `build` script is `webpack`, and `start` runs the bundle with `node` and no preload. The `dev` script runs the sources with `node --watch --import motherload/register main.ts`, where the preload turns each data file into a module as Node loads it. The `typecheck` script runs `tsc --noEmit --runExternalCode`, which runs the content mapper.
- In `webpack.config.mjs`, the rule `{ test: /\.(toml|csv|md)$/, use: "motherload/webpack" }` turns each data file into a module holding its parsed value. The rest is webpack's own setup for Node: `target: "node24"`, `output.module` for an ES module, and swc-loader for TypeScript.
- In `tsconfig.json`, `contentMappers` names `motherload` for `.toml`, `.csv` and `.md`, the three formats the project imports. The option `allowImportingTsExtensions` lets `main.ts` import `./site.ts` by its own name, as Node runs it in `dev`.
- The module `site.ts` imports `config.toml`, `users.csv` and `post.md` and reads a value from each; `main.ts` prints them, with a `@ts-expect-error` on a key `config.toml` does not have.
- The `.vscode/` and `.zed/` directories hold the editor settings from [Editors](https://motherload.dev/#editors).

## In your own project

- Run `npm install -D motherload typescript@beta webpack webpack-cli swc-loader @swc/core @types/node` instead of the `link:` dependency on `../..`.
- Nothing else here exists only because Motherload is linked from this repository.

## Notes

- ts-loader does not run on TypeScript 7, whose package has no JavaScript API: ts-loader 9.5.4 fails with `TypeError: Cannot read properties of undefined (reading 'fileExists')`. swc-loader only strips the types, and `tsc` checks them.
- Running `nub install` warns that it ignored `@swc/core`'s build script; swc-loader works without it.
