# Motherload examples

One complete, working project for each setup the [docs](https://motherload.dev/#setup) describe. Each imports the same three data files as typed modules, type-checks them through the content mapper, and runs them in every mode its tool has: a script, a dev server, a production build, a bundle, a test runner. They are the models to copy when you set Motherload up in a project of your own, and each README's "How Motherload is wired in" section lists every line Motherload needs.

| Example | Setup | What runs |
| --- | --- | --- |
| [node](./node) | `node --import motherload/register` ([Node](https://motherload.dev/#setup-node)) | a script, and tests with Node's test runner |
| [nub](./nub) | the preload in `nub.jsonc` ([Nub](https://motherload.dev/#setup-nub)) | a script, and tests with `nub --test` |
| [bun](./bun) | the preload in `bunfig.toml`, and `Bun.build` with `motherload/esbuild` ([Bun](https://motherload.dev/#setup-bun)) | a script, `bun test`, and a bundle |
| [vite](./vite) | `motherload/vite` in a Vite page ([Vite](https://motherload.dev/#setup-vite)) | the dev server, the build and `vite preview`, and Vitest |
| [nextjs](./nextjs) | `withMotherload` from `motherload/next`: the loader under Turbopack and webpack, and the type check inside `next build` ([Next.js](https://motherload.dev/#setup-nextjs)) | an App Router app: `next dev`, and `next build` and `next start` with each bundler |
| [esbuild](./esbuild) | `motherload/esbuild` ([esbuild](https://motherload.dev/#setup-esbuild)) | a script, bundled into one ES module that runs with plain Node |
| [webpack](./webpack) | `motherload/webpack` ([webpack](https://motherload.dev/#setup-webpack)) | a script, bundled into one ES module that runs with plain Node |
| [rspack](./rspack) | `motherload/webpack` ([Rspack](https://motherload.dev/#setup-rspack)) | a script, bundled into one ES module that runs with plain Node |
| [jest](./jest) | `motherload/jest` ([Jest](https://motherload.dev/#setup-jest)) | Jest, in an ES module run and a CommonJS run |
| [cloudflare-workers](./cloudflare-workers) | `motherload/vite` beside the Cloudflare Vite plugin ([Cloudflare](https://motherload.dev/#setup-cloudflare-workers)) | a Worker in workerd: `vite dev`, the build and `vite preview`, Vitest inside workerd, and `wrangler deploy --dry-run`, all without a Cloudflare account |

Every example imports the same files: `config.toml` (a title and a `[server]` table), `users.csv` (two rows, one with a quoted comma) and `post.md` (frontmatter and a body), and shows the same values from them. Every one also carries the editor settings of [Editors](https://motherload.dev/#editors) for VS Code, Cursor and Zed.

## Using one in your own project

Open the example for your setup and read its README's "How Motherload is wired in": every line Motherload needs, file by file, with the reason for each. Copy those lines, and install the packages from npm instead of copying the example's dependencies, which link this repository:

```sh
npm install -D motherload typescript@beta   # a dependency, not -D, in an app that runs under the preload
```

Each README's "In your own project" lists anything else that exists only because the example lives in this repository, such as Next.js's Turbopack root.

The examples pin TypeScript to `7.1.0-beta` exactly: a range such as `^7.1.0-beta`, which `npm install -D typescript@beta` writes, also takes the 7.1 nightlies, which sort above the beta.

## Running one here

Each example links this repository's own `motherload` as a `link:` dependency on `../..`, which needs the repository's dependencies installed:

```sh
nub install              # at the repository root
cd examples/<name>
nub install              # or pnpm install; npm does not take link: dependencies
```

Then follow the example's README: it names each command and what it prints. The test `tests/examples.test.ts` runs every installed example this way.
