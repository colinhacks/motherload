# Motherload with Jest

A Jest test in TypeScript that imports a TOML file, a CSV file and a Markdown file as typed modules through Motherload's transformer, in both of Jest's module modes ([Jest](https://motherload.dev/#setup-jest)).

## Run it

```sh
nub run typecheck   # tsc --noEmit --runExternalCode: no output, exit 0
nub run test        # Jest with ES modules: "Tests: 1 passed, 1 total"
nub run test:cjs    # Jest with CommonJS: "Tests: 1 passed, 1 total"
```

The ES module run also prints Node's `ExperimentalWarning: VM Modules is an experimental feature`.

## How Motherload is wired in

- In `package.json`, `motherload` is a development dependency, for the type check and the transformer. The packages `typescript` 7.1 beta, `jest`, `@jest/globals` and `@types/node` are development dependencies too, and the CommonJS run adds `babel-jest`, `@babel/core`, `@babel/preset-env` and `@babel/preset-typescript`. The `test` script runs `jest` under `NODE_OPTIONS=--experimental-vm-modules`, the flag Jest needs for ES modules, and the `test:cjs` script runs it without the flag, with `jest.cjs.config.js`. The `typecheck` script runs `tsc --noEmit --runExternalCode`, which runs the content mapper.
- In `jest.config.js`, the ES module run, `transform` sends `.toml`, `.csv` and `.md` files to `motherload/jest`: Jest reads test code through its own runtime, which no preload reaches. Its `extensionsToTreatAsEsm` lists the three beside `.ts`, so a data file's module is an ES module like the test that imports it. No transform claims the `.ts` files, so Jest strips their types itself.
- In `jest.cjs.config.js`, the CommonJS run, the same transformer writes CommonJS, since Jest asks for it there, and babel-jest compiles the `.ts` files to CommonJS with preset-env and preset-typescript.
- In `tsconfig.json`, `contentMappers` names `motherload` for `.toml`, `.csv` and `.md`, the three formats the project imports. The option `allowImportingTsExtensions` lets the files import `./site.ts` by its own name, and `erasableSyntaxOnly` and `verbatimModuleSyntax` keep the TypeScript to what stripping its types runs.
- The module `site.ts` imports `config.toml`, `users.csv` and `post.md` and reads a value from each; `site.test.ts` checks them, with a `@ts-expect-error` on a key `config.toml` does not have.
- The `.vscode/` and `.zed/` directories hold the editor settings from [Editors](https://motherload.dev/#editors).

## In your own project

- Run `npm install -D motherload typescript@beta jest @jest/globals @types/node` instead of the `link:` dependency on `../..`, and for the CommonJS run `npm install -D babel-jest @babel/core @babel/preset-env @babel/preset-typescript`.
- Keep the configuration of the mode you run, as `jest.config.js`; the ES module run needs no Babel.
- Nothing else here exists only because Motherload is linked from this repository.

## Notes

- Without the data extensions in `extensionsToTreatAsEsm`, the ES module run gets each data file as CommonJS, and a default import reads its `exports` object: `TypeError: Cannot read properties of undefined (reading 'port')`.
- A transform of `"\\.[jt]sx?$": "babel-jest"` with no Babel config fails a `.ts` test that has a type annotation (`Jest encountered an unexpected token`); the ES module run needs no transform for `.ts`.
- Jest 30.5 prints only its summary lines when it sees a coding agent's environment (`AI_AGENT`, `CLAUDECODE`).
