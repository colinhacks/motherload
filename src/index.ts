// The types a schema's generated module refers to, `import type { Schema } from "motherload"`:
// @motherload/schema's. motherload has no run-time export: a data file's module is data, and a
// schema's module carries its own validator.
export type { Schema, SchemaError, StandardJSONSchemaV1, StandardSchemaV1, StandardTypedV1 } from "@motherload/schema";
