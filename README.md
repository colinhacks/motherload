<p align="center">
  <h1 align="center"><img src="site/public/motherload.svg" width="56" height="56" alt=""><br/>Motherload</h1>
  <p align="center">
    Import a data file and get a typed module
    <br/>
    by <a href="https://x.com/colinhacks">@colinhacks</a>
  </p>
</p>
<br/>

<p align="center">
<a href="https://github.com/colinhacks/motherload" rel="nofollow"><img src="https://img.shields.io/github/stars/colinhacks/motherload" alt="stars"></a>
</p>

<br/>

Motherload is a set of TypeScript loaders for data formats: import a TOML, YAML, JSON5, JSONC, CSV, TSV, Markdown, text or `.env` file, or a JSON Schema, and get a typed module.

It's powered by TypeScript's [_content mappers_](https://github.com/microsoft/typescript-go/pull/4712) (introduced typescript@7.1). These are like plugins for TypeScript, and it lets Motherload provide _full static types_ for the imported data, in a way that natively integrates with `tsc`.

## Setup

```sh
npm install -D motherload typescript@next
```

Add Motherload to `tsconfig.json`, with the extensions it should own:

```jsonc
{
  "compilerOptions": {
    "types": ["motherload/client"] // types `?raw` imports
  },
  "contentMappers": [
    {
      "package": "motherload",
      "extensions": [
        ".toml", ".yaml", ".yml", ".json5", ".jsonc", ".env",
        ".csv", ".tsv", ".txt", ".md",
        ".schema.jsonc", ".schema.json5"
      ]
    }
  ]
}
```

Type-check with `--runExternalCode`; without it, `tsc` skips content mappers. Run the code with the preload:

```sh
tsc --noEmit --runExternalCode
node --import motherload/register main.ts
```

Each tool has its setup in the docs:

- [Node.js](site/content/docs/index.mdx#runtimes): `--import motherload/register`
- [Nub](site/content/docs/index.mdx#runtimes): `"preload": ["motherload/register"]` in `nub.jsonc`
- [esbuild](site/content/docs/index.mdx#bundlers): `plugins: [motherload()]` from `motherload/esbuild`
- [VS Code, Cursor and Zed](site/content/docs/index.mdx#editors): the TypeScript 7.1 language server, with content mappers on

## Loaders

Each file is parsed when the module is built, so a bundle holds the data and no parser. The default export is the data, typed as `as const` would type it. Add `?raw` to any import for the file's text.

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

A `.yml` file is read the same way. A file of several documents (`---`) is the list of them.

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

### `.env`

Importing a `.env` file sets its variables on `process.env` when the module runs. A variable the environment already sets keeps its value, and no value from the file is in a bundle.

```sh
DATABASE_URL=postgres://localhost/app
PORT=3000
```

```ts
import "./.env";

process.env.DATABASE_URL; // string
process.env.PORT;         // string
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

A `.md` file is the object `{ md, frontmatter }`: the body, without the frontmatter, and the YAML frontmatter, typed from the file. Each part is also a named export.

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
// post: { readonly md: string; readonly frontmatter: { readonly title: "Hello"; readonly draft: false } }

import { frontmatter } from "./post.md"; // one part; a bundle leaves out the body
```

### `.schema.jsonc`

A JSON Schema becomes its type and a validator. Install `ajv` and `ajv-formats` beside Motherload; the validator is compiled when the module is built, so the module imports nothing at run time. The suffix is `.schema.jsonc` or `.schema.json5`, not `.schema.json`, because TypeScript refuses a content mapper extension that ends in `.json`; a `.schema.jsonc` file is read as JSON with comments, so comments and trailing commas are allowed.

```jsonc
{
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "role": { "enum": ["admin", "member"] }
  },
  "required": ["name"],
  "additionalProperties": false
}
```

```ts
import user, { type Type as User } from "./user.schema.jsonc";
// User: { name: string; role?: "admin" | "member" }

const valid: User = user.parse(input); // or a TypeError listing each issue
user.is(input);                        // input is User
user["~standard"].validate(input);     // Standard Schema v1
```

### `.schema.json5`

The same as `.schema.jsonc`, with the schema written in JSON5.

```json5
{
  type: 'object',
  properties: {
    x: { type: 'integer' },
    y: { type: 'integer' },
  },
  required: ['x', 'y'],
  additionalProperties: false,
}
```

```ts
import point, { type Type as Point } from "./point.schema.json5";
// Point: { x: number; y: number }
```

## Errors

Invalid data in a file is a type error, at the line and column of the problem:

```
$ tsc --noEmit --runExternalCode
users.csv:3:1 - error motherload1: This row has 3 fields; the header has 2.

3 Grace,grace@example.com,extra
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
```

## Repository

[PLAN.md](./PLAN.md) is where Motherload is going, [DESIGN.md](./DESIGN.md) records each decision and its evidence, and [AGENTS.md](./AGENTS.md) describes the layout and the checks. [lab/basic](./lab/basic) imports every format.
