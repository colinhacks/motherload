<p align="center">
  <h1 align="center">🪎<br/>Motherload</h1>
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

```ts
import config from "./app.toml";           // { readonly port: 8080; readonly name: "demo" }
import text from "./app.toml?raw";         // the file's text
import users from "./users.csv";           // readonly { readonly name: string; readonly email: string }[]
import post, { frontmatter } from "./post.md";  // the body, and frontmatter: { readonly title: "Hello" }
import "./.env";                           // process.env.DATABASE_URL: string
import user, { type Type as User } from "./user.schema.json";

const input: User = user.parse(JSON.parse(body));   // validated, or a TypeError listing every issue
```

The Motherload package is a TypeScript 7.1 content mapper for `.toml`, `.yaml`, `.yml`, `.json5`, `.jsonc`, `.env`, `.csv`, `.tsv`, `.txt` and `.md` files and for `.schema.json` files, which become the type they describe and a validator. A preload and an esbuild plugin make the same imports run.

## Setup

```jsonc
// tsconfig.json
{
  "compilerOptions": { "types": ["motherload/client"] },   // types `?raw` imports
  "contentMappers": [
    { "package": "motherload", "extensions": [".toml", ".yaml", ".yml", ".json5", ".jsonc", ".env", ".csv", ".tsv", ".txt", ".md", ".schema.json"] }
  ]
}
```

```sh
tsc --noEmit --runExternalCode                 # the type check runs content mappers only with this flag
node --import motherload/register main.ts      # the preload
```

```ts
// esbuild
import motherload from "motherload/esbuild";
await build({ entryPoints: ["main.ts"], bundle: true, plugins: [motherload()] });
```

Schema imports need two optional peer dependencies in the project: `json-schema-to-typescript` for the types and `ajv` for the validator (with `ajv-formats` to check `format`). The validator is compiled when the module is built, so the module imports nothing at run time.

Importing a `.env` file sets its variables on `process.env` when the module runs; a variable the environment already sets keeps its value, and no value from the file is in a bundle.

## Repository

[PLAN.md](./PLAN.md) is where Motherload is going, [DESIGN.md](./DESIGN.md) records each decision and its evidence, and [AGENTS.md](./AGENTS.md) describes the layout and the checks. [lab/basic](./lab/basic) imports every format.
