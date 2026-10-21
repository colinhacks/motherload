# Motherload with Vite

A Vite page in TypeScript, with no framework, that imports a TOML file, a CSV file and a Markdown file as typed modules and shows their values, with a Vitest test of the same module, both through Motherload's Vite plugin ([Vite](https://motherload.dev/#setup-vite)).

## Run it

```sh
nub run typecheck   # tsc --noEmit --runExternalCode: no output, exit 0
nub run test        # vitest run: "Tests  1 passed (1)"
nub run dev         # http://localhost:5173: the page shows {"title":"Motherload example","port":8080,"users":["Ada Lovelace","Hopper, Grace"],"post":"Hello, Motherload"}
nub run build       # vite build: dist/index.html and dist/assets/index-*.js, which holds the values
nub run preview     # dist/ on http://localhost:4173, the same page
```

While `nub run dev` runs, an edit to `config.toml` reloads the page with the new value (`[vite] (client) page reload config.toml`).

## How Motherload is wired in

- In `package.json`, `motherload` is a development dependency: the plugin runs in the dev server, the build and Vitest, and the built page carries the values. The packages `typescript` 7.1 beta, `vite` and `vitest` are development dependencies too. The `typecheck` script runs `tsc --noEmit --runExternalCode`, which runs the content mapper; the build checks no types.
- In `vite.config.ts`, `plugins: [motherload()]` turns each data file into a module holding its parsed value. Vitest reads the same file, so the test needs no config of its own.
- In `tsconfig.json`, `contentMappers` names `motherload` for `.toml`, `.csv` and `.md`, the three formats the project imports. The option `allowImportingTsExtensions` lets `main.ts` import `./site.ts` by its own name, and `lib` has `dom` for the page.
- The module `site.ts` imports `config.toml`, `users.csv` and `post.md` and reads a value from each; `main.ts`, which `index.html` loads, writes them into the page, and `site.test.ts` checks them, with a `@ts-expect-error` on a key `config.toml` does not have.
- The `.vscode/` and `.zed/` directories hold the editor settings from [Editors](https://motherload.dev/#editors).

## In your own project

- Run `npm install -D motherload typescript@beta vite vitest` instead of the `link:` dependency on `../..`.
- Nothing else here exists only because Motherload is linked from this repository.

## Notes

- In the dev server, the page imports `/config.toml?import`, which is the plugin's module; `/config.toml` itself, opened in a tab or with `curl`, is the file as written, served as a static file by Vite.
