<p align="center">
  <h1 align="center"><img src="https://motherload.dev/motherload.svg" width="56" height="56" alt=""><br/>Motherload</h1>
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
  "contentMappers": [
    {
      "package": "motherload",
      "extensions": [
        ".toml", ".yaml", ".yml", ".json5", ".jsonc", ".env",
        ".csv", ".tsv", ".txt", ".md", ".schema.jsonc"
      ]
    }
  ]
}
```

Type-check with `--runExternalCode`, without which `tsc` skips content mappers, and run the code with the preload:

```sh
tsc --noEmit --runExternalCode
node --import motherload/register main.ts
```

Each tool has its setup in [the docs](https://motherload.dev):

- [Node.js](https://motherload.dev/#node): `--import motherload/register`
- [Nub](https://motherload.dev/#plugins): `"preload": ["motherload/register"]` in `nub.jsonc`
- [esbuild](https://motherload.dev/#plugins): `plugins: [motherload()]` from `motherload/esbuild`
- [VS Code, Cursor and Zed](https://motherload.dev/#editors): the TypeScript 7.1 language server, with content mappers on

Each format is also a package of its own, `@motherload/toml`, `@motherload/schema` and so on, for a project that reads only some of them: see [One format at a time](https://motherload.dev/#one-format-at-a-time).

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
// post: {
//   readonly md: string;
//   readonly frontmatter: {
//     readonly title: "Hello";
//     readonly draft: false;
//   };
// }

// One part alone: a bundle leaves out the body.
import { frontmatter } from "./post.md";
```

### `.schema.jsonc`

A JSON Schema becomes its type and a validator. The validator is compiled by [ajv](https://ajv.js.org) when the module is built, so the module imports nothing at run time.

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

// Never throws: the value, or every issue.
const result = user.validate(input);
if (result.issues) {
  result.issues; // [{ message, path, keyword, params, schemaPath }]
} else {
  result.value; // User: the input itself
}

user.is(input); // input is User; stops at the first failure

// Standard Schema v1 and Standard JSON Schema v1
user["~standard"].validate(input); // the same as validate
user["~standard"].jsonSchema;
```

- **Issues:** an issue's `path` holds object keys as strings and array indexes as numbers, and ends with the key of a missing or unexpected property: `["members", 1, "name"]`, `["role"]`.
- **References:** a `$ref` to another schema file, by a path relative to the file that holds it, is followed. `{ "$ref": "./address.schema.jsonc" }` is that file's `Type`, and `"./shared.schema.jsonc#/$defs/tag"` the type it declares for that definition, both imported from that file's module. The validator checks the other file's rules too.
- **The suffix:** `.schema.jsonc`, not `.schema.json`, because TypeScript refuses a content mapper extension that ends in `.json`. The file is read as JSON with comments, so comments and trailing commas are allowed.

> [!NOTE]
> A schema can also be written in JSON5, as a `.schema.json5` file: add `.schema.json5` to the `extensions` list.

## Errors

Invalid data in a file is a type error, at the line and column of the problem:

```
$ tsc --noEmit --runExternalCode
users.csv:3:1 - error motherload1: This row has 3 fields; the header has 2.

3 Grace,grace@example.com,extra
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
```
