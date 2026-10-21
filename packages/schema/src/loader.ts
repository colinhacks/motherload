// A schema file's module: the type the schema describes and a validator (schema.ts). A schema is
// written as JSON with comments, `.schema.jsonc`, or as JSON5, `.schema.json5`.
import type { LoaderPlugin } from "@motherload/core";
import { schemaCode, schemaTypes } from "./schema.ts";

/** The schema loader, whose generated types import `Schema` from `typesFrom`: this package, or `motherload`, which combines it with the other formats. */
export function schemaLoader(typesFrom: string): LoaderPlugin {
  return {
    name: "@motherload/schema",
    extensions: [".schema.jsonc", ".schema.json5"],
    filter: /\.schema\.(?:jsonc|json5)$/,
    load: schemaCode,
    types: (source, path) => schemaTypes(source, path, typesFrom),
  };
}

export const loader = schemaLoader("@motherload/schema");
