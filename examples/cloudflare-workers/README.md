# Motherload with Cloudflare Workers

A Cloudflare Worker whose `fetch` handler answers with values from a TOML file, a CSV file and a Markdown file, imported as typed modules. Vite builds it, with the Cloudflare Vite plugin and `motherload/vite`, and serves it in workerd, the Workers runtime; the tests run inside workerd too, through Cloudflare's Vitest plugin ([Cloudflare Workers](https://motherload.dev/#setup-cloudflare-workers)). Everything here runs locally, with no Cloudflare account.

## Run it

```sh
nub run typecheck              # tsc --noEmit --runExternalCode: no output, exit 0
nub run test                   # vitest run, inside workerd: Tests 2 passed (2)
nub run dev                    # vite dev: the Worker on http://localhost:5173
nub run build                  # the type check, then vite build: dist/motherload_example/index.js (0.97 kB) and its wrangler.json
nub run preview                # vite preview: the built Worker on http://localhost:4173
nubx wrangler deploy --dry-run # after the build: "Total Upload: 0.95 KiB", then "--dry-run: exiting now."
```

With `dev` or `preview` running (`dev` shown):

```text
$ curl localhost:5173
{"title":"Motherload example","port":8080,"users":["Ada Lovelace","Hopper, Grace"],"post":"Hello, Motherload"}
```

The built `dist/motherload_example/index.js` holds the three files' values as plain objects and imports nothing.

## How Motherload is wired in

- In `package.json`, `motherload` is a development dependency: the plugin builds each data file into a module at build time, and the Worker's bundle carries the values alone. TypeScript 7.1 beta, Vite, the Cloudflare Vite and Vitest plugins, `@cloudflare/workers-types`, `@types/node` (for the config files) and wrangler are development dependencies too. The `typecheck` script is `tsc --noEmit --runExternalCode`, the flag that lets `tsc` run the content mapper, and `build` runs it before `vite build`, which strips types without checking them.
- In `vite.config.ts`, `motherload()` sits beside `cloudflare()` and turns each data import into a module, in the dev server, the build and the preview.
- In `vitest.config.ts`, `motherload()` sits beside `cloudflareTest()`, which runs the tests inside workerd with the Worker of `wrangler.jsonc`.
- In `tsconfig.json`, `contentMappers` names `motherload` for `.toml`, `.csv` and `.md`, the three formats the Worker imports. The `types` are Workers' (`@cloudflare/workers-types`), the Vitest plugin's (`cloudflare:test`) and Node's. The option `allowImportingTsExtensions` exists only because Motherload is linked from this repository (below).
- In `wrangler.jsonc`, the Worker sets no `compatibility_flags`: the data files' modules use no Node API, so the Worker needs no `nodejs_compat`.
- The module `site.ts` imports `config.toml`, `users.csv` and `post.md` and reads a value from each; `src/worker.ts` answers every request with it as JSON, and `test/site.test.ts` checks it, directly and through the Worker's `fetch`, with a `@ts-expect-error` on a key `config.toml` does not have. The file `src/env.d.ts` declares the Worker's module, the type of `exports` in the tests.
- The `.vscode/` and `.zed/` directories hold the editor settings from [Editors](https://motherload.dev/#editors).

## In your own project

- Run `npm install -D motherload typescript@beta vite @cloudflare/vite-plugin @cloudflare/vitest-plugin @cloudflare/workers-types @types/node vitest wrangler` instead of the `link:` dependency on `../..`.
- Drop `allowImportingTsExtensions` from `tsconfig.json`. The `link:` dependency is Motherload's TypeScript source, whose files import each other by their `.ts` names, and the type check reaches it through `vite.config.ts`; the published package is compiled.

## Notes

- **Wrangler's own bundler.** Run `wrangler deploy` after `vite build`, which writes `.wrangler/deploy/config.json` pointing wrangler at the built Worker. Wrangler bundling `src/worker.ts` itself, as `wrangler deploy -c wrangler.jsonc` and `wrangler dev -c wrangler.jsonc` do, takes no Vite plugin and fails with `No loader is configured for ".toml" files`.
- **Without the plugin,** `vite build` fails with a parse error in `users.csv`, and the tests with `ReferenceError: server is not defined` at `config.toml`'s `[server]`.
