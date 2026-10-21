# Motherload with Nub

A script and its test that import a TOML file, a CSV file and a Markdown file as typed modules, loaded by Motherload's preload from `nub.jsonc`, so `nub main.ts` needs no flag ([Nub](https://motherload.dev/#setup-nub)).

## Run it

```sh
nub run typecheck   # tsc --noEmit --runExternalCode: no output, exit 0
nub run start       # nub main.ts: {"title":"Motherload example","port":8080,"users":["Ada Lovelace","Hopper, Grace"],"post":"Hello, Motherload"}
nub run test        # nub --test, Node's test runner under Nub: 1 test, 1 pass
```

## How Motherload is wired in

- In `package.json`, `motherload` is a dependency, not a development dependency: the preload turns each data file into a module when the script runs. The development dependencies are `typescript` 7.1 beta and `@types/node`. The `start` script is `nub main.ts` and `test` is `nub --test`, with no flag, and `typecheck` runs `tsc --noEmit --runExternalCode`, which runs the content mapper.
- The `nub.jsonc` file sets `"preload": ["motherload/register"]`, which Nub loads before the code it runs, for `nub main.ts` and for each test file `nub --test` runs.
- In `tsconfig.json`, `contentMappers` names `motherload` for `.toml`, `.csv` and `.md`, the three formats the project imports. The `allowImportingTsExtensions` option lets `main.ts` import `./site.ts` by its own name, as Nub runs it.
- The module `site.ts` imports `config.toml`, `users.csv` and `post.md` and reads a value from each; `main.ts` prints them, and `site.test.ts` checks them, with a `@ts-expect-error` on a key `config.toml` does not have.
- The `.vscode/` and `.zed/` directories hold the editor settings from [Editors](https://motherload.dev/#editors).

## In your own project

- Run `nub add motherload` and `nub add -D typescript@beta @types/node` instead of the `link:` dependency on `../..`.
- Nothing else here exists only because Motherload is linked from this repository.

## Notes

- Nub reads `.toml` files itself, and the preload takes them over: under `nub.jsonc`'s preload a TOML integer above 2^53 is a `bigint` and an offset date-time a `Date`, where Nub's own loader fails on the integer and turns the date-time into a plain object.
- A `NODE_COMPAT=1` in the environment makes Nub run as plain Node, which skips `nub.jsonc`: `nub main.ts` then fails with `ERR_UNKNOWN_FILE_EXTENSION` on `config.toml`. Unset it, or set it to `0`.
- Under strict Node, `nub --node main.ts` fails the same way, since `--node` skips `nub.jsonc` too; `nub --node --import motherload/register main.ts` runs.
