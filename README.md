<p align="center">
  <h1 align="center"><img src="https://raw.githubusercontent.com/colinhacks/motherload/main/site/public/motherload.svg" width="56" height="56" alt=""><br/>Motherload</h1>
  <p align="center">
    Import data files into TypeScript, fully typed
    <br/>
    by <a href="https://x.com/colinhacks">@colinhacks</a>
  </p>
</p>
<br/>

<p align="center">
<a href="https://github.com/colinhacks/motherload" rel="nofollow"><img src="https://img.shields.io/github/stars/colinhacks/motherload" alt="stars"></a>
</p>

<br/>

Motherload is a set of TypeScript loaders for data formats: import a TOML, YAML, JSONC, JSON5, CSV, TSV, Markdown, text or `.env` file and get a typed module.

It's powered by TypeScript's [_content mappers_](https://github.com/microsoft/typescript-go/pull/4712) (introduced typescript@7.1). These are like plugins for TypeScript, and it lets Motherload provide _full static types_ for the imported data, in a way that natively integrates with `tsc`.

## Setup

Motherload needs:

- **TypeScript 7.1 beta or later**, the first release with content mappers.
- **Node 24 or later, Bun or nub.**

```sh
npm install -D motherload typescript@beta
```

An app that runs under the preload, not as a bundle, loads its data files at run time, so it installs Motherload as a dependency: `npm install motherload`.

Name Motherload in `tsconfig.json`, with the extensions it should own, and type-check with `--runExternalCode`, the flag that lets `tsc` run content mappers:

```jsonc
// tsconfig.json
{
  "compilerOptions": { /* ... */ },
  "contentMappers": [
    {
      "package": "motherload",
      "extensions": [
        ".toml", ".yaml", ".yml", ".jsonc", ".json5", ".env",
        ".csv", ".tsv", ".txt", ".md"
      ]
    }
  ]
}
```

```jsonc
// package.json
{
  "scripts": {
    "typecheck": "tsc --noEmit --runExternalCode"
  }
}
```

Load Motherload when your code runs, so that a data-file import works at run time too. On Node:

```sh
node --import motherload/register main.ts
```

| Runtime or bundler | Setup |
| --- | --- |
| Bun | `preload = ["motherload/register"]` in `bunfig.toml` |
| nub | `"preload": ["motherload/register"]` in `nub.jsonc` |
| Vite, Vitest, Rollup, Rolldown | `import motherload from "motherload/vite"`, then `motherload()` in `plugins` |
| esbuild, `Bun.build` | `import motherload from "motherload/esbuild"`, then `motherload()` in `plugins` |
| webpack, Rspack | `use: "motherload/webpack"` in a rule for the data files, in `module.rules` |
| Next.js | `import { withMotherload } from "motherload/next"`, then `export default withMotherload(nextConfig)`: the loader for Turbopack and webpack, and the type check inside `next build` ([setup](https://motherload.dev/#setup-nextjs)) |
| Jest | `"motherload/jest"` in `transform`, for the data files ([setup](https://motherload.dev/#setup-jest)) |

Each setup has a working example project to copy: [examples](https://github.com/colinhacks/motherload/tree/main/examples).

In VS Code or Cursor, install the **TypeScript 7** extension (`TypeScriptTeam.native-preview`) and point it at your project's TypeScript, since the extension bundles TypeScript 7.0:

```jsonc
// .vscode/settings.json
{
  "js/ts.experimental.useTsgo": true,
  "js/ts.tsdk.path": "./node_modules/typescript"
}
```

Then trust the workspace, and click **Allow** when the extension asks to use the workspace's TypeScript. Zed takes a few more settings: see [Editors](https://motherload.dev/#editors).

The `motherload` package provides one unified content mapper for all data formats. You can also consume them [à la carte](https://motherload.dev/#loaders-a-la-carte).

## Loaders

Each file is parsed when the module is built, so a bundle holds the data and no parser. The default export is the data, typed as `as const` would type it.

### `.toml`

```toml
name = "demo"
port = 8080

[server]
host = "localhost"
```

```ts
import config from "./config.toml";
// config: {
//   readonly name: "demo";
//   readonly port: 8080;
//   readonly server: { readonly host: "localhost" };
// }
```

### `.yaml`

Motherload reads `.yaml` and `.yml` files:

```yaml
- name: Ada
  role: admin
- name: Grace
  role: member
```

```ts
import team from "./team.yaml";
// team: readonly [
//   { readonly name: "Ada"; readonly role: "admin" },
//   { readonly name: "Grace"; readonly role: "member" },
// ]
```

A file of several documents, separated by `---`, is the list of them:

```yaml
kind: Service
---
kind: Deployment
replicas: 2
```

```ts
import deploy from "./deploy.yaml";
// deploy: readonly [
//   { readonly kind: "Service" },
//   { readonly kind: "Deployment"; readonly replicas: 2 },
// ]
```

### `.jsonc`

```jsonc
{
  // the editor's font size
  "fontSize": 14,
  "exclude": ["dist",],
}
```

```ts
import settings from "./settings.jsonc";
// settings: {
//   readonly fontSize: 14;
//   readonly exclude: readonly ["dist"];
// }
```

### `.json5`

```json5
{
  // shown on the sign-in page
  welcome: 'Welcome back',
  retries: 3,
}
```

```ts
import strings from "./strings.json5";
// strings: { readonly welcome: "Welcome back"; readonly retries: 3 }
```

> [!NOTE]
> To import a JSON Schema file, `.schema.jsonc` or `.schema.json5`, as its type and a validator, use [dotschema](https://www.npmjs.com/package/dotschema).

### `.env`

Importing a `.env` file sets its variables on `process.env` when the module runs, and types each of them as a `string`:

```sh
DATABASE_URL=postgres://localhost/app
PORT=3000
```

```ts
import "./.env";

process.env.DATABASE_URL; // string
process.env.PORT;         // string
```

A variable the environment already sets keeps its value, and a bundle holds none of the file's values.

A file whose name ends in `.env`, such as `local.env`, needs no setup. Imported first, its values win over `.env`'s:

```ts
import "./local.env";
import "./.env";
```

Any other name, such as `.env.local`, goes in `extensions` in full:

```jsonc
{ "package": "motherload", "extensions": [".env", ".env.local" /* ... */] }
```

A missing file fails the type check and the build. To load nothing in its place, turn off `strict` and TypeScript's check of side-effect imports:

```jsonc
{
  "compilerOptions": { "noUncheckedSideEffectImports": false },
  "contentMappers": [{ "package": "motherload", "extensions": [/* ... */], "options": { "strict": false } }]
}
```

### `.csv`

The header names the columns, and every value is a string, as written.

```csv
name,email
Ada,ada@example.com
Grace,grace@example.com
```

```ts
import users from "./users.csv";
// users: readonly {
//   readonly name: string;
//   readonly email: string;
// }[]
```

### `.tsv`

The same as `.csv`, with a tab between fields.

```tsv
player	score
Ada	42
Grace	37
```

```ts
import scores from "./scores.tsv";
// scores: readonly {
//   readonly player: string;
//   readonly score: string;
// }[]
```

### `.txt`

```txt
Notes from the lab.
```

```ts
import notes from "./notes.txt";
// notes: string
```

### `.md`

Importing a `.md` file gives its frontmatter, typed from the file, and its Markdown body:

```md
---
title: Hello
draft: false
---
# Hello

The body of the post.
```

```ts
import post from "./post.md";
// post: {
//   readonly md: string;
//   readonly frontmatter: {
//     readonly title: "Hello";
//     readonly draft: false;
//   };
// }
```

Each part is also a named export, so a bundle that imports the frontmatter alone leaves out the body:

```ts
import { frontmatter } from "./post.md";
```

## Errors

Invalid data in a file is a type error, at the line and column of the problem:

```
$ tsc --noEmit --runExternalCode
users.csv:3:1 - error motherload1: This row has 3 fields; the header has 2.

3 Grace,grace@example.com,extra
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
```
