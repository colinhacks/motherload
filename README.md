# ⛏️ Motherload

Import a data file and get a typed module.

```ts
import config from "./app.toml";           // { port: number; name: string }
import { literal } from "./app.toml";      // { readonly port: 8080; readonly name: "demo" }
import { raw } from "./app.toml";          // the file's text
import user, { type Type as User } from "./user.schema.json";

const input: User = user.parse(JSON.parse(body));   // validated, or a TypeError listing every issue
```

The Motherload package is a TypeScript 7.1 content mapper for `.toml`, `.yaml`, `.yml`, `.json5`, `.jsonc` and `.env` files, which become modules of data, and for `.schema.json` files, which become the type they describe and a validator. A preload and an esbuild plugin make the same imports run.

Status: pre-alpha, not published.

## Setup

```jsonc
// tsconfig.json
{
  "contentMappers": [
    { "package": "motherload", "extensions": [".toml", ".yaml", ".yml", ".json5", ".jsonc", ".env", ".schema.json"] }
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
await build({ entryPoints: ["main.ts"], bundle: true, plugins: [motherload] });
```

Schema imports need two optional peer dependencies in the project: `json-schema-to-typescript` for the types and `ajv` for the validator (with `ajv-formats` to check `format`). The validator is compiled when the module is built, so the module imports nothing at run time.

A `.env` module carries the file's values: importing one into browser code puts them in the bundle.

## Repository

[PLAN.md](./PLAN.md) is where Motherload is going, [DESIGN.md](./DESIGN.md) records each decision and its evidence, and [AGENTS.md](./AGENTS.md) describes the layout and the checks. [lab/basic](./lab/basic) imports every format.
